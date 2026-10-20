import { Component, DestroyRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { SingleDateCalendarComponent } from '../../../all-bookings/components/single-date-calendar/single-date-calendar.component';
import { SaveThemeRequest, SeasonalTheme, ThemeTargetApp } from '../../interfaces/control-center.model';
import { ControlCenterError, parseControlCenterError } from '../../interfaces/control-center-error.util';
import { riyadhToday } from '../../interfaces/riyadh-time.util';
import { ControlCenterService } from '../../services/control-center.service';
import { ColorFieldComponent } from '../../color-field/color-field.component';

/** #RRGGBB or #AARRGGBB, as the API accepts. */
const HEX_PATTERN = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
/** 2–100 chars of a-z 0-9 - _, starting with a letter or digit. */
const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,99}$/;
// Not named "URL": that would shadow the global URL class, which Angular's dev-server
// (HMR) code calls in this module — the chunk then throws on load and the route never opens.
const BANNER_URL_PATTERN = /^https?:\/\/\S+$/i;

type DateField = 'startDate' | 'endDate';
type FieldName = 'nameAr' | 'key' | 'startDate' | 'endDate' | 'primaryColor' | 'secondaryColor' | 'bannerUrl';

/** Both days are inclusive, so the end may equal the start but not precede it. */
function dateOrderValidator(group: AbstractControl): ValidationErrors | null {
  const { startDate, endDate } = group.value as { startDate: string; endDate: string };
  return startDate && endDate && endDate < startDate ? { dateOrder: true } : null;
}

/**
 * Create / edit popup for a seasonal theme. Opened by `open`; `themeId` = edit (the theme is
 * re-read from GET /themes/{id}), null = create. Emits `saved` with the stored theme and
 * `missing` when the theme no longer exists (404).
 */
@Component({
  selector: 'app-theme-form-drawer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, A11yModule, MaterialModule, TablerIconsModule, TranslateModule, SingleDateCalendarComponent, ColorFieldComponent],
  templateUrl: './theme-form-drawer.component.html',
  styleUrl: './theme-form-drawer.component.scss'
})
export class ThemeFormDrawerComponent implements OnChanges, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private fb = inject(FormBuilder);
  private service = inject(ControlCenterService);

  @Input() open = false;
  @Input() themeId: string | null = null;
  @Output() saved = new EventEmitter<SeasonalTheme>();
  @Output() missing = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  loading = false;
  saving = false;
  serverError: ControlCenterError | null = null;
  /** The stored theme while editing — only changed fields are sent back. */
  private original: SeasonalTheme | null = null;
  private request?: Subscription;

  readonly appOptions: { value: ThemeTargetApp; labelKey: string }[] = [
    { value: 'Client', labelKey: 'd3.controlCenter.apps.Client' },
    { value: 'Host', labelKey: 'd3.controlCenter.apps.Host' },
    { value: 'All', labelKey: 'd3.controlCenter.apps.all' },
  ];

  readonly dateFields: { name: DateField; labelKey: string }[] = [
    { name: 'startDate', labelKey: 'd3.controlCenter.themes.form.startDate' },
    { name: 'endDate', labelKey: 'd3.controlCenter.themes.form.endDate' },
  ];

  readonly form = this.fb.nonNullable.group({
    nameAr: ['', [Validators.required, Validators.maxLength(200)]],
    key: ['', [Validators.required, Validators.pattern(KEY_PATTERN)]],
    app: this.fb.nonNullable.control<ThemeTargetApp>('Client'),
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    primaryColor: ['#153E36', [Validators.required, Validators.pattern(HEX_PATTERN)]],
    secondaryColor: ['#DDBE74', Validators.pattern(HEX_PATTERN)],
    bannerUrl: ['', [Validators.pattern(BANNER_URL_PATTERN), Validators.maxLength(1000)]],
    isActive: true,
  }, { validators: dateOrderValidator });

  constructor() {
    // An edit makes a previous server rejection stale.
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.serverError = null; });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      document.body.style.overflow = this.open ? 'hidden' : '';
      if (this.open) this.start();
      else this.request?.unsubscribe();
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open && !this.saving) this.close();
  }

  get isEdit(): boolean {
    return !!this.themeId;
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  close(): void {
    this.closed.emit();
  }

  setApp(app: ThemeTargetApp): void {
    this.form.controls.app.setValue(app);
    this.form.controls.app.markAsDirty();
  }

  // ── Open: blank form, or the stored theme ───────────────────

  private start(): void {
    this.serverError = null;
    this.original = null;
    this.fill(null);
    if (!this.themeId) return;

    this.loading = true;
    this.request?.unsubscribe();
    this.request = this.service.getTheme(this.themeId).subscribe({
      next: theme => {
        this.original = theme;
        this.fill(theme);
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        const parsed = parseControlCenterError(err, this.translate);
        this.toastr.error(parsed.message);
        if (parsed.errorCode === 'APP_THEME_NOT_FOUND' || parsed.status === 404) this.missing.emit();
        else this.close();
      },
    });
  }

  private fill(t: SeasonalTheme | null): void {
    this.form.reset({
      nameAr: t?.nameAr ?? '',
      key: t?.key ?? '',
      app: t ? (t.app === 'Client' || t.app === 'Host' ? t.app : 'All') : 'Client',
      startDate: t?.startDate ?? '',
      endDate: t?.endDate ?? '',
      primaryColor: t ? t.colors?.primary ?? '' : '#153E36',
      secondaryColor: t ? t.colors?.secondary ?? '' : '#DDBE74',
      bannerUrl: t?.bannerUrl ?? '',
      isActive: t?.isActive ?? true,
    }, { emitEvent: false });
  }

  // ── Dates (Saudi days, inclusive) ───────────────────────────

  setDate(name: DateField, iso: string): void {
    const control = this.form.controls[name];
    control.setValue(iso);
    control.markAsDirty();
    control.markAsTouched();
  }

  /** Editing keeps past days reachable; a new theme can't start before today (Riyadh). */
  minDateFor(name: DateField): string | null {
    const start = this.form.controls.startDate.value;
    if (name === 'endDate') return start || (this.isEdit ? null : riyadhToday());
    return this.isEdit ? null : riyadhToday();
  }

  dateLabel(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const locale = this.currentDir === 'rtl' ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', calendar: 'gregory' })
      .format(new Date(Date.UTC(y, m - 1, d)));
  }

  // ── Validation ──────────────────────────────────────────────

  error(name: FieldName): string | null {
    const server = this.serverError;
    if (name === 'key' && server?.errorCode === 'APP_THEME_KEY_ALREADY_EXISTS') {
      return this.translate.instant('d3.controlCenter.themes.errors.keyTaken');
    }
    if (server?.fieldErrors[name]) return server.fieldErrors[name];

    const control = this.form.controls[name];
    if (!control.touched) return null;
    const t = (key: string) => this.translate.instant(`d3.controlCenter.themes.errors.${key}`);
    if (control.hasError('required')) return t('required');
    if (control.hasError('maxlength')) return t('tooLong');
    if (control.hasError('pattern')) {
      if (name === 'key') return t('key');
      if (name === 'bannerUrl') return t('url');
      return t('color');
    }
    if (name === 'endDate' && this.form.hasError('dateOrder')) return t('dateOrder');
    return null;
  }

  /** The server message when no field claims it (e.g. VALIDATION_ERROR from the main API). */
  get generalError(): string | null {
    const server = this.serverError;
    if (!server || server.errorCode === 'APP_THEME_KEY_ALREADY_EXISTS') return null;
    const fields: FieldName[] = ['nameAr', 'key', 'startDate', 'endDate', 'primaryColor', 'secondaryColor', 'bannerUrl'];
    return fields.some(f => server.fieldErrors[f]) ? null : server.message;
  }

  // ── Save ────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.saving || this.loading) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const body = this.isEdit ? this.changedFields() : this.createBody();
    if (this.isEdit && !Object.keys(body).length) {
      this.close();
      return;
    }

    this.saving = true;
    this.serverError = null;
    const request$ = this.isEdit ? this.service.updateTheme(this.themeId!, body) : this.service.createTheme(body);
    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: theme => {
        this.saving = false;
        this.toastr.success(this.translate.instant(this.isEdit ? 'd3.controlCenter.themes.updateSuccess' : 'd3.controlCenter.themes.createSuccess'));
        this.saved.emit(theme);
      },
      error: err => {
        this.saving = false;
        const parsed = parseControlCenterError(err, this.translate);
        if (parsed.errorCode === 'APP_THEME_NOT_FOUND' || (this.isEdit && parsed.status === 404)) {
          this.toastr.error(parsed.message);
          this.missing.emit();
          return;
        }
        this.serverError = parsed;
        if (parsed.status === 403 || parsed.status >= 500 || !parsed.status) this.toastr.error(parsed.message);
      },
    });
  }

  private values() {
    const v = this.form.getRawValue();
    return {
      nameAr: v.nameAr.trim(),
      key: v.key.trim(),
      app: v.app,
      startDate: v.startDate,
      endDate: v.endDate,
      primaryColor: v.primaryColor.trim().toUpperCase(),
      secondaryColor: v.secondaryColor.trim().toUpperCase(),
      bannerUrl: v.bannerUrl.trim(),
      isActive: v.isActive,
    };
  }

  /** Create: empty optional fields are simply left out. */
  private createBody(): SaveThemeRequest {
    const v = this.values();
    const body: SaveThemeRequest = {
      nameAr: v.nameAr, key: v.key, app: v.app, startDate: v.startDate, endDate: v.endDate,
      primaryColor: v.primaryColor, isActive: v.isActive,
    };
    if (v.secondaryColor) body.secondaryColor = v.secondaryColor;
    if (v.bannerUrl) body.bannerUrl = v.bannerUrl;
    return body;
  }

  /** Edit: only what changed; "" clears an optional field (secondary colour, banner). */
  private changedFields(): SaveThemeRequest {
    const v = this.values();
    const o = this.original;
    const originalApp: ThemeTargetApp = o?.app === 'Client' || o?.app === 'Host' ? o.app : 'All';
    const body: SaveThemeRequest = {};
    if (v.nameAr !== (o?.nameAr ?? '')) body.nameAr = v.nameAr;
    if (v.key !== (o?.key ?? '')) body.key = v.key;
    if (v.app !== originalApp) body.app = v.app;
    if (v.startDate !== (o?.startDate ?? '')) body.startDate = v.startDate;
    if (v.endDate !== (o?.endDate ?? '')) body.endDate = v.endDate;
    if (v.primaryColor !== (o?.colors?.primary ?? '').toUpperCase()) body.primaryColor = v.primaryColor;
    if (v.secondaryColor !== (o?.colors?.secondary ?? '').toUpperCase()) body.secondaryColor = v.secondaryColor;
    if (v.bannerUrl !== (o?.bannerUrl ?? '')) body.bannerUrl = v.bannerUrl;
    if (v.isActive !== o?.isActive) body.isActive = v.isActive;
    return body;
  }
}
