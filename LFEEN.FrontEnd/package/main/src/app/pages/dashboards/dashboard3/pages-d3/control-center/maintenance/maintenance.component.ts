import { Component, DestroyRef, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription, filter, of } from 'rxjs';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { LoginService } from '../../../services/login/login.service';
import { SingleDateCalendarComponent } from '../../all-bookings/components/single-date-calendar/single-date-calendar.component';
import { TimeSelectComponent } from '../../platform-offers/components/time-select/time-select.component';
import { OfferConfirmDialogComponent, OfferConfirmDialogData } from '../../platform-offers/components/offer-confirm-dialog/offer-confirm-dialog.component';
import {
  ControlCenterApp, MaintenanceTarget, ReleaseConfig, SaveMaintenanceRequest,
} from '../interfaces/control-center.model';
import { ControlCenterError, parseControlCenterError } from '../interfaces/control-center-error.util';
import { APP_RUNTIME_PERMISSIONS, hasAppRuntimePermission } from '../interfaces/control-center-permissions';
import { riyadhLocalToOffset, riyadhNowLocal, riyadhToday, utcToRiyadhLocal } from '../interfaces/riyadh-time.util';
import { ControlCenterService } from '../services/control-center.service';
import { PhoneFrameComponent } from '../phone-frame/phone-frame.component';

const MESSAGE_MAX = 1000;

type ScheduleField = 'startsAt' | 'endsAt';

/**
 * A schedule needs at least one end of the window: an empty start means "from now",
 * an empty end means "until switched off". The end must follow the start and be ahead.
 * Values are Riyadh wall-clock "yyyy-MM-ddTHH:mm", so plain string comparison works.
 */
function scheduleValidator(group: AbstractControl): ValidationErrors | null {
  const { enabled, scheduled, startsAt, endsAt } = group.value as {
    enabled: boolean; scheduled: boolean; startsAt: string | null; endsAt: string | null;
  };
  if (!enabled || !scheduled) return null;
  if (!startsAt && !endsAt) return { scheduleRequired: true };
  if (startsAt && endsAt && endsAt <= startsAt) return { scheduleOrder: true };
  if (endsAt && endsAt <= riyadhNowLocal()) return { schedulePast: true };
  return null;
}

@Component({
  selector: 'app-control-center-maintenance',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent, PhoneFrameComponent, SingleDateCalendarComponent, TimeSelectComponent],
  templateUrl: './maintenance.component.html',
  styleUrl: './maintenance.component.scss'
})
export class MaintenanceComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  private login = inject(LoginService);
  private service = inject(ControlCenterService);

  /** Fires after a successful save, so the page can refresh the summary. */
  @Output() saved = new EventEmitter<void>();

  readonly messageMax = MESSAGE_MAX;

  currentLang = this.translate.currentLang || 'ar';
  selectedApp: ControlCenterApp = 'client';

  loading = false;
  /** Why the releases couldn't be read (null = no error). */
  loadError: string | null = null;
  saving = false;
  /** Server-side rejection: per-field messages + the general one shown above the actions. */
  serverError: ControlCenterError | null = null;

  /** Android + iOS rows for the selected app (Web is filtered out). */
  private releases: ReleaseConfig[] = [];
  private request?: Subscription;

  readonly appOptions: { value: ControlCenterApp; labelKey: string }[] = [
    { value: 'client', labelKey: 'd3.controlCenter.apps.Client' },
    { value: 'host', labelKey: 'd3.controlCenter.apps.Host' },
  ];

  readonly targetOptions: { value: MaintenanceTarget; labelKey: string }[] = [
    { value: 'All', labelKey: 'd3.controlCenter.maintenance.targets.all' },
    { value: 'Ios', labelKey: 'd3.controlCenter.maintenance.targets.ios' },
    { value: 'Android', labelKey: 'd3.controlCenter.maintenance.targets.android' },
  ];

  readonly scheduleFields: { name: ScheduleField; labelKey: string; hintKey: string }[] = [
    { name: 'startsAt', labelKey: 'd3.controlCenter.maintenance.startsAt', hintKey: 'd3.controlCenter.maintenance.startsAtHint' },
    { name: 'endsAt', labelKey: 'd3.controlCenter.maintenance.endsAt', hintKey: 'd3.controlCenter.maintenance.endsAtHint' },
  ];

  readonly form = this.fb.nonNullable.group({
    target: this.fb.nonNullable.control<MaintenanceTarget>('All'),
    enabled: false,
    scheduled: false,
    startsAt: this.fb.control<string | null>(null),
    endsAt: this.fb.control<string | null>(null),
    message: ['', Validators.maxLength(MESSAGE_MAX)],
  }, { validators: scheduleValidator });

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });
    // Any edit makes a previous server rejection stale.
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.serverError = null; });
  }

  ngOnInit(): void {
    if (!this.canManage) this.form.disable({ emitEvent: false });
    this.load();
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get canManage(): boolean {
    return hasAppRuntimePermission(this.login, APP_RUNTIME_PERMISSIONS.manageMaintenance);
  }

  // ── Loading ─────────────────────────────────────────────────

  selectApp(app: ControlCenterApp): void {
    if (app === this.selectedApp || this.saving) return;
    this.selectedApp = app;
    this.load();
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading = true;
    this.loadError = null;
    this.serverError = null;
    this.request = this.service.getReleases(this.selectedApp).subscribe({
      next: rows => {
        this.releases = rows.filter(r => r.platform === 'Android' || r.platform === 'Ios');
        this.applyFromReleases(this.form.controls.target.value);
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.loadError = parseControlCenterError(err, this.translate).message;
      },
    });
  }

  /** Switching the target re-reads that platform's saved values (pending edits are dropped). */
  setTarget(target: MaintenanceTarget): void {
    if (target === this.form.controls.target.value) return;
    this.applyFromReleases(target);
  }

  private rowsFor(target: MaintenanceTarget): ReleaseConfig[] {
    return target === 'All' ? this.releases : this.releases.filter(r => r.platform === target);
  }

  /**
   * Fills the form from the targeted rows. With "All" the platforms may disagree; the
   * enabled one wins (that's the state worth seeing), else iOS. `mixedNote` explains it.
   */
  private applyFromReleases(target: MaintenanceTarget): void {
    const rows = this.rowsFor(target);
    const source = rows.find(r => r.isMaintenanceEnabled) ?? rows.find(r => r.platform === 'Ios') ?? rows[0];
    const startsAt = source?.maintenanceStartsAtUtc ? utcToRiyadhLocal(source.maintenanceStartsAtUtc) : null;
    const endsAt = source?.maintenanceEndsAtUtc ? utcToRiyadhLocal(source.maintenanceEndsAtUtc) : null;
    this.form.reset({
      target,
      enabled: !!source?.isMaintenanceEnabled,
      scheduled: !!(startsAt || endsAt),
      startsAt,
      endsAt,
      message: source?.maintenanceMessageAr ?? '',
    }, { emitEvent: false });
    if (!this.canManage) this.form.disable({ emitEvent: false });
    this.serverError = null;
  }

  /** "Maintenance is on for Android only" — shown when "All" covers platforms in different states. */
  get mixedNote(): string | null {
    if (this.form.controls.target.value !== 'All' || this.releases.length < 2) return null;
    const on = this.releases.filter(r => r.isMaintenanceEnabled);
    if (on.length !== 1) return null;
    return this.translate.instant('d3.controlCenter.maintenance.mixedNote', {
      platform: this.translate.instant(`d3.controlCenter.platforms.${on[0].platform}`),
    });
  }

  /** Locked out right now on at least one targeted platform. */
  get isActiveNow(): boolean {
    return this.rowsFor(this.form.controls.target.value).some(r => r.isMaintenanceActiveNow);
  }

  // ── Schedule date/time (Riyadh wall-clock "yyyy-MM-ddTHH:mm") ─

  datePart(value: string | null): string {
    return value ? value.slice(0, 10) : '';
  }

  timePart(value: string | null): string {
    return value && value.length >= 16 ? value.slice(11, 16) : '';
  }

  minDateFor(name: ScheduleField): string {
    const today = riyadhToday();
    if (name === 'startsAt') return today;
    const start = this.datePart(this.form.controls.startsAt.value);
    return start > today ? start : today;
  }

  setDatePart(name: ScheduleField, iso: string): void {
    const control = this.form.controls[name];
    control.setValue(`${iso}T${this.timePart(control.value) || '00:00'}`);
    control.markAsDirty();
  }

  setTimePart(name: ScheduleField, time: string): void {
    const control = this.form.controls[name];
    control.setValue(`${this.datePart(control.value) || riyadhToday()}T${time}`);
    control.markAsDirty();
  }

  clearDate(name: ScheduleField): void {
    const control = this.form.controls[name];
    control.setValue(null);
    control.markAsDirty();
  }

  dateTimeLabel(value: string | null): string {
    const iso = this.datePart(value);
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const [h, min] = (this.timePart(value) || '00:00').split(':').map(Number);
    // Built as a UTC date and formatted in UTC so the browser's own zone never shifts it.
    const at = new Date(Date.UTC(y, m - 1, d, h, min));
    const locale = this.currentDir === 'rtl' ? 'ar-SA' : 'en-US';
    const date = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', calendar: 'gregory' }).format(at);
    const time = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', hour: 'numeric', minute: '2-digit', hour12: true }).format(at);
    return `${date} · ${time}`;
  }

  get scheduleError(): string | null {
    const server = this.serverError?.fieldErrors;
    if (server?.['startsAt'] || server?.['endsAt']) return null;
    const errors = this.form.errors;
    if (!errors) return null;
    const touched = this.form.controls.startsAt.touched || this.form.controls.endsAt.touched || this.form.controls.scheduled.dirty;
    if (!touched) return null;
    if (errors['scheduleRequired']) return 'd3.controlCenter.maintenance.errors.scheduleRequired';
    if (errors['scheduleOrder']) return 'd3.controlCenter.maintenance.errors.scheduleOrder';
    if (errors['schedulePast']) return 'd3.controlCenter.maintenance.errors.schedulePast';
    return null;
  }

  fieldServerError(name: string): string | null {
    return this.serverError?.fieldErrors[name] ?? null;
  }

  // ── Save ────────────────────────────────────────────────────

  get canSave(): boolean {
    return this.canManage && this.form.dirty && !this.saving && !this.loading;
  }

  onCancel(): void {
    this.applyFromReleases(this.form.controls.target.value);
  }

  onSave(): void {
    if (!this.canSave) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const body: SaveMaintenanceRequest = { target: v.target, isEnabled: v.enabled, messageAr: v.message.trim() };
    if (v.enabled) {
      // Explicit nulls: "start now" / "until switched off".
      body.startsAt = v.scheduled && v.startsAt ? riyadhLocalToOffset(v.startsAt) : null;
      body.endsAt = v.scheduled && v.endsAt ? riyadhLocalToOffset(v.endsAt) : null;
    }

    // Turning maintenance on locks every user of the targeted platforms out — confirm first.
    const turningOn = v.enabled && this.rowsFor(v.target).some(r => !r.isMaintenanceEnabled);
    const confirmed$: Observable<boolean> = turningOn ? this.confirmEnable(v.target, v.scheduled && !!v.startsAt) : of(true);
    confirmed$.pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.submit(body));
  }

  private confirmEnable(target: MaintenanceTarget, scheduled: boolean): Observable<boolean> {
    const data: OfferConfirmDialogData = {
      title: 'd3.controlCenter.maintenance.confirm.title',
      message: this.translate.instant(scheduled ? 'd3.controlCenter.maintenance.confirm.scheduledMessage' : 'd3.controlCenter.maintenance.confirm.message', {
        app: this.translate.instant(`d3.controlCenter.apps.${this.selectedApp === 'client' ? 'Client' : 'Host'}`),
        platforms: this.translate.instant(`d3.controlCenter.maintenance.targets.${target.toLowerCase()}`),
      }),
      confirmLabel: 'd3.controlCenter.maintenance.confirm.action',
      icon: 'tool',
      tone: 'warning',
    };
    return this.dialog.open(OfferConfirmDialogComponent, { width: '420px', data }).afterClosed();
  }

  private submit(body: SaveMaintenanceRequest): void {
    this.saving = true;
    this.serverError = null;
    this.service.saveMaintenance(this.selectedApp, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.saving = false;
        // Merge the returned platforms in, then re-read the form from the stored truth.
        this.releases = this.releases.map(r => updated.find(u => u.platform === r.platform) ?? r);
        this.applyFromReleases(body.target);
        this.toastr.success(this.translate.instant('d3.controlCenter.maintenance.saveSuccess'));
        this.saved.emit();
      },
      error: err => {
        this.saving = false;
        const parsed = parseControlCenterError(err, this.translate);
        this.serverError = parsed;
        if (parsed.status === 403 || parsed.status >= 500 || !parsed.status) this.toastr.error(parsed.message);
      },
    });
  }
}
