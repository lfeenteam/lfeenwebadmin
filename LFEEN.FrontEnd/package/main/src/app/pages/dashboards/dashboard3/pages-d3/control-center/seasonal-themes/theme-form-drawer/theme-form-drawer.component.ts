import { Component, DestroyRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { A11yModule } from '@angular/cdk/a11y';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { SingleDateCalendarComponent } from '../../../all-bookings/components/single-date-calendar/single-date-calendar.component';
import { ControlCenterApp, SaveThemeRequest, SeasonalTheme, todayIsoDate } from '../../interfaces/control-center.model';
import { ControlCenterService } from '../../services/control-center.service';
import { ColorFieldComponent } from '../../color-field/color-field.component';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const KEY = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type DateField = 'startDate' | 'endDate';

function dateOrderValidator(group: AbstractControl): ValidationErrors | null {
  const { startDate, endDate } = group.value as { startDate: string; endDate: string };
  return startDate && endDate && endDate < startDate ? { dateOrder: true } : null;
}

/**
 * Create / edit drawer for a seasonal theme. Open it by setting `open`; pass `theme`
 * to edit (null = create). Emits `saved` with the stored theme.
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
  @Input() theme: SeasonalTheme | null = null;
  @Output() saved = new EventEmitter<SeasonalTheme>();
  @Output() closed = new EventEmitter<void>();

  saving = false;
  /** Set when the API rejects the key as taken (409) — cleared once the key changes. */
  keyTaken = false;

  readonly appOptions: { value: ControlCenterApp; labelKey: string }[] = [
    { value: 'client', labelKey: 'd3.controlCenter.apps.client' },
    { value: 'merchant', labelKey: 'd3.controlCenter.apps.merchant' },
  ];

  readonly dateFields: { name: DateField; labelKey: string }[] = [
    { name: 'startDate', labelKey: 'd3.controlCenter.themes.form.startDate' },
    { name: 'endDate', labelKey: 'd3.controlCenter.themes.form.endDate' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(40)]],
    key: ['', [Validators.required, Validators.pattern(KEY), Validators.maxLength(40)]],
    app: this.fb.nonNullable.control<ControlCenterApp>('client'),
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    primaryColor: ['#153E36', [Validators.required, Validators.pattern(HEX)]],
    secondaryColor: ['#DDBE74', [Validators.required, Validators.pattern(HEX)]],
    bannerUrl: ['', Validators.pattern(/^https:\/\/\S+$/)],
    enabled: false,
  }, { validators: dateOrderValidator });

  constructor() {
    this.form.controls.key.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.keyTaken = false; });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      document.body.style.overflow = this.open ? 'hidden' : '';
      if (this.open) this.reset();
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
    return !!this.theme;
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  close(): void {
    this.closed.emit();
  }

  setApp(app: ControlCenterApp): void {
    this.form.controls.app.setValue(app);
    this.form.controls.app.markAsDirty();
  }

  // ── Dates ───────────────────────────────────────────────────

  setDate(name: DateField, iso: string): void {
    const control = this.form.controls[name];
    control.setValue(iso);
    control.markAsDirty();
    control.markAsTouched();
  }

  /** Editing keeps past dates reachable; a new theme can't start in the past. */
  minDateFor(name: DateField): string | null {
    const start = this.form.controls.startDate.value;
    if (name === 'endDate') return start || (this.isEdit ? null : todayIsoDate());
    return this.isEdit ? null : todayIsoDate();
  }

  dateLabel(iso: string): string {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const locale = this.currentDir === 'rtl' ? 'ar-SA' : 'en-US';
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', calendar: 'gregory' }).format(new Date(y, m - 1, d));
  }

  // ── Validation ──────────────────────────────────────────────

  error(name: 'name' | 'key' | 'startDate' | 'endDate' | 'primaryColor' | 'secondaryColor' | 'bannerUrl'): string | null {
    const control = this.form.controls[name];
    if (name === 'key' && this.keyTaken) return 'd3.controlCenter.themes.errors.keyTaken';
    if (!control.touched) return null;
    if (control.hasError('required')) return 'd3.controlCenter.themes.errors.required';
    if (control.hasError('pattern')) {
      if (name === 'key') return 'd3.controlCenter.themes.errors.key';
      if (name === 'bannerUrl') return 'd3.controlCenter.themes.errors.url';
      return 'd3.controlCenter.themes.errors.color';
    }
    if (name === 'endDate' && this.form.hasError('dateOrder')) return 'd3.controlCenter.themes.errors.dateOrder';
    return null;
  }

  // ── Save ────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.saving) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastr.error(this.translate.instant('d3.toast.fillAllRequired'));
      return;
    }

    const v = this.form.getRawValue();
    const body: SaveThemeRequest = {
      name: v.name.trim(),
      key: v.key.trim(),
      app: v.app,
      startDate: v.startDate,
      endDate: v.endDate,
      primaryColor: v.primaryColor.toUpperCase(),
      secondaryColor: v.secondaryColor.toUpperCase(),
      bannerUrl: v.bannerUrl.trim() || null,
      enabled: v.enabled,
    };

    this.saving = true;
    this.service.saveTheme(this.theme?.id ?? null, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: theme => {
        this.saving = false;
        this.toastr.success(this.translate.instant(this.isEdit ? 'd3.controlCenter.themes.updateSuccess' : 'd3.controlCenter.themes.createSuccess'));
        this.saved.emit(theme);
      },
      error: err => {
        this.saving = false;
        if ((err as { status?: number })?.status === 409) {
          this.keyTaken = true;
          return;
        }
        this.toastr.error(this.translate.instant('d3.toast.saveError'));
      },
    });
  }

  private reset(): void {
    const t = this.theme;
    this.keyTaken = false;
    this.form.reset({
      name: t?.name ?? '',
      key: t?.key ?? '',
      app: t?.app ?? 'client',
      startDate: t?.startDate ?? '',
      endDate: t?.endDate ?? '',
      primaryColor: t?.primaryColor ?? '#153E36',
      secondaryColor: t?.secondaryColor ?? '#DDBE74',
      bannerUrl: t?.bannerUrl ?? '',
      enabled: t?.enabled ?? false,
    });
  }
}
