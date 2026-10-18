import { AfterViewInit, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import {
  AppPlatformStatus, ControlCenterApp, ControlCenterSummary, ControlCenterTab, MaintenanceSettings, MaintenanceTarget,
  SaveMaintenanceRequest,
} from './interfaces/control-center.model';
import { ControlCenterService } from './services/control-center.service';
import { PhoneFrameComponent } from './phone-frame/phone-frame.component';
import { SingleDateCalendarComponent } from '../all-bookings/components/single-date-calendar/single-date-calendar.component';
import { TimeSelectComponent } from '../platform-offers/components/time-select/time-select.component';
import { AppUpdatesComponent } from './app-updates/app-updates.component';
import { SeasonalThemesComponent } from './seasonal-themes/seasonal-themes.component';

type ScheduleField = 'startsAt' | 'endsAt';

const TITLE_MAX = 60;
const MESSAGE_MAX = 240;

/** A schedule needs both ends, and the end must come after the start. */
function scheduleValidator(group: AbstractControl): ValidationErrors | null {
  const { scheduled, startsAt, endsAt } = group.value as { scheduled: boolean; startsAt: string | null; endsAt: string | null };
  if (!scheduled) return null;
  if (!startsAt || !endsAt) return { scheduleRequired: true };
  return endsAt > startsAt ? null : { scheduleOrder: true };
}

@Component({
  selector: 'app-control-center',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent, PhoneFrameComponent, SingleDateCalendarComponent, TimeSelectComponent, AppUpdatesComponent, SeasonalThemesComponent],
  templateUrl: './control-center.component.html',
  styleUrl: './control-center.component.scss'
})
export class ControlCenterComponent implements OnInit, AfterViewInit {
  @ViewChild('tabsNav') private tabsNav?: ElementRef<HTMLElement>;
  /** More tabs hidden past the start / end edge — drives the arrow cues on narrow screens. */
  canScrollStart = false;
  canScrollEnd = false;

  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private fb = inject(FormBuilder);
  private service = inject(ControlCenterService);

  readonly titleMax = TITLE_MAX;
  readonly messageMax = MESSAGE_MAX;

  currentLang = this.translate.currentLang || 'ar';
  activeTab: ControlCenterTab = 'maintenance';
  selectedApp: ControlCenterApp = 'client';

  summary: ControlCenterSummary | null = null;
  summaryError = false;
  settingsLoading = false;
  settingsError = false;
  saving = false;
  /** Last loaded/saved copy — "cancel" restores it. */
  private saved: MaintenanceSettings | null = null;

  private summaryRequest?: Subscription;
  private settingsRequest?: Subscription;

  readonly tabs: { value: ControlCenterTab; labelKey: string; icon: string }[] = [
    { value: 'maintenance', labelKey: 'd3.controlCenter.tabs.maintenance', icon: 'tool' },
    { value: 'updates', labelKey: 'd3.controlCenter.tabs.updates', icon: 'download' },
    { value: 'themes', labelKey: 'd3.controlCenter.tabs.themes', icon: 'palette' },
  ];

  readonly appOptions: { value: ControlCenterApp; labelKey: string }[] = [
    { value: 'client', labelKey: 'd3.controlCenter.apps.client' },
    { value: 'merchant', labelKey: 'd3.controlCenter.apps.merchant' },
  ];

  readonly targetOptions: { value: MaintenanceTarget; labelKey: string }[] = [
    { value: 'all', labelKey: 'd3.controlCenter.maintenance.targets.all' },
    { value: 'ios', labelKey: 'd3.controlCenter.maintenance.targets.ios' },
    { value: 'android', labelKey: 'd3.controlCenter.maintenance.targets.android' },
  ];

  readonly scheduleFields: { name: ScheduleField; labelKey: string }[] = [
    { name: 'startsAt', labelKey: 'd3.controlCenter.maintenance.startsAt' },
    { name: 'endsAt', labelKey: 'd3.controlCenter.maintenance.endsAt' },
  ];

  readonly form = this.fb.nonNullable.group({
    target: this.fb.nonNullable.control<MaintenanceTarget>('all'),
    enabled: false,
    scheduled: false,
    startsAt: this.fb.control<string | null>(null),
    endsAt: this.fb.control<string | null>(null),
    title: ['', [Validators.required, Validators.maxLength(TITLE_MAX)]],
    message: ['', [Validators.required, Validators.maxLength(MESSAGE_MAX)]],
    bypassKey: '',
  }, { validators: scheduleValidator });

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLang = event.lang;
        // Label widths change with the language.
        setTimeout(() => this.updateTabsScroll());
      });
  }

  ngOnInit(): void {
    this.loadSummary();
    this.loadSettings();
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  // ── Summary ─────────────────────────────────────────────────

  loadSummary(): void {
    this.summaryRequest?.unsubscribe();
    this.summaryError = false;
    this.summaryRequest = this.service.getSummary().subscribe({
      next: summary => { this.summary = summary; },
      error: () => { this.summary = null; this.summaryError = true; },
    });
  }

  trackApp(status: AppPlatformStatus): string {
    return `${status.app}-${status.platform}`;
  }

  // ── Tabs ────────────────────────────────────────────────────

  setActiveTab(tab: ControlCenterTab, event?: Event): void {
    this.activeTab = tab;
    // Bring a half-hidden tab fully into view once picked.
    (event?.currentTarget as HTMLElement | undefined)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  ngAfterViewInit(): void {
    // Tab labels come from translations, so measure after they've rendered.
    setTimeout(() => this.updateTabsScroll());
  }

  @HostListener('window:resize')
  updateTabsScroll(): void {
    const nav = this.tabsNav?.nativeElement;
    if (!nav) return;
    // In RTL scrollLeft runs 0 → negative, so work with its magnitude.
    const scrolled = Math.abs(nav.scrollLeft);
    this.canScrollStart = scrolled > 1;
    this.canScrollEnd = scrolled + nav.clientWidth < nav.scrollWidth - 1;
  }

  scrollTabs(toward: 'start' | 'end'): void {
    const nav = this.tabsNav?.nativeElement;
    if (!nav) return;
    const step = nav.clientWidth * 0.6;
    const sign = (toward === 'end' ? 1 : -1) * (this.currentDir === 'rtl' ? -1 : 1);
    nav.scrollBy({ left: sign * step, behavior: 'smooth' });
  }

  // ── Maintenance settings ────────────────────────────────────

  selectApp(app: ControlCenterApp): void {
    if (app === this.selectedApp || this.saving) return;
    this.selectedApp = app;
    this.loadSettings();
  }

  setTarget(target: MaintenanceTarget): void {
    const control = this.form.controls.target;
    if (control.value === target) return;
    control.setValue(target);
    control.markAsDirty();
  }

  loadSettings(): void {
    this.settingsRequest?.unsubscribe();
    this.settingsLoading = true;
    this.settingsError = false;
    this.settingsRequest = this.service.getMaintenance(this.selectedApp).subscribe({
      next: settings => {
        this.applySettings(settings);
        this.settingsLoading = false;
      },
      error: () => {
        this.settingsLoading = false;
        this.settingsError = true;
      },
    });
  }

  get hasBypassKey(): boolean {
    return !!this.saved?.hasBypassKey;
  }

  get scheduleError(): 'scheduleRequired' | 'scheduleOrder' | null {
    const errors = this.form.errors;
    if (!errors || !(this.form.controls.startsAt.touched || this.form.controls.endsAt.touched)) return null;
    return errors['scheduleOrder'] ? 'scheduleOrder' : errors['scheduleRequired'] ? 'scheduleRequired' : null;
  }

  // ── Schedule date/time (same calendar + time picker as platform offers) ──
  // Values are local "yyyy-MM-ddTHH:mm" strings.

  datePart(value: string | null): string {
    return value ? value.slice(0, 10) : '';
  }

  timePart(value: string | null): string {
    return value && value.length >= 16 ? value.slice(11, 16) : '';
  }

  /** Start can't be in the past; end can't be before the start day. */
  minDateFor(name: ScheduleField): string {
    const today = this.todayIso();
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
    control.setValue(`${this.datePart(control.value) || this.todayIso()}T${time}`);
    control.markAsDirty();
  }

  dateTimeLabel(value: string | null): string {
    const iso = this.datePart(value);
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const [h, min] = (this.timePart(value) || '00:00').split(':').map(Number);
    const at = new Date(y, m - 1, d, h, min);
    // Date and time go through the same locale, so the digits match (Arabic-Indic in Arabic).
    const locale = this.currentDir === 'rtl' ? 'ar-SA' : 'en-US';
    const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', calendar: 'gregory' }).format(at);
    const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true }).format(at);
    return `${date} · ${time}`;
  }

  private todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  showError(name: 'title' | 'message'): boolean {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  get canSave(): boolean {
    return this.form.dirty && !this.saving && !this.settingsLoading;
  }

  onCancel(): void {
    if (this.saved) this.applySettings(this.saved);
  }

  onSave(): void {
    if (!this.canSave) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastr.error(this.translate.instant('d3.toast.fillAllRequired'));
      return;
    }

    const v = this.form.getRawValue();
    const body: SaveMaintenanceRequest = {
      app: this.selectedApp,
      target: v.target,
      enabled: v.enabled,
      scheduled: v.scheduled,
      startsAt: v.scheduled ? v.startsAt : null,
      endsAt: v.scheduled ? v.endsAt : null,
      title: v.title.trim(),
      message: v.message.trim(),
      bypassKey: v.bypassKey.trim() || undefined,
    };

    this.saving = true;
    this.service.saveMaintenance(body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: settings => {
        this.saving = false;
        this.applySettings(settings);
        this.toastr.success(this.translate.instant('d3.controlCenter.maintenance.saveSuccess'));
        // Turning maintenance on/off changes the platform statuses above.
        this.loadSummary();
      },
      error: () => {
        this.saving = false;
        this.toastr.error(this.translate.instant('d3.toast.saveError'));
      },
    });
  }

  private applySettings(settings: MaintenanceSettings): void {
    this.saved = settings;
    this.form.reset({
      target: settings.target,
      enabled: settings.enabled,
      scheduled: settings.scheduled,
      startsAt: settings.startsAt,
      endsAt: settings.endsAt,
      title: settings.title,
      message: settings.message,
      bypassKey: '',
    });
  }

  // ── Preview ─────────────────────────────────────────────────

  /** Android-only maintenance previews on an Android frame; otherwise iOS. */
  get previewPlatform(): 'ios' | 'android' {
    return this.form.controls.target.value === 'android' ? 'android' : 'ios';
  }
}
