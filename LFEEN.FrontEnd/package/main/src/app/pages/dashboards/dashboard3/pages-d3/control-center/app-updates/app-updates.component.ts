import { Component, DestroyRef, OnInit, inject } from '@angular/core';
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
import { AppVersionSettings, ControlCenterApp, ControlCenterPlatform, UpdatePolicy } from '../interfaces/control-center.model';
import { ControlCenterService } from '../services/control-center.service';
import { PhoneFrameComponent } from '../phone-frame/phone-frame.component';

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const MESSAGE_MAX = 240;

/** Negative when a < b, 0 when equal — compares "major.minor.patch" numerically. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** The minimum supported version can't be newer than the latest release. */
function versionOrderValidator(group: AbstractControl): ValidationErrors | null {
  const { latestVersion, minSupportedVersion } = group.value as { latestVersion: string; minSupportedVersion: string };
  if (!VERSION_PATTERN.test(latestVersion) || !VERSION_PATTERN.test(minSupportedVersion)) return null;
  return compareVersions(minSupportedVersion, latestVersion) > 0 ? { versionOrder: true } : null;
}

@Component({
  selector: 'app-control-center-updates',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent, PhoneFrameComponent],
  templateUrl: './app-updates.component.html',
  styleUrl: './app-updates.component.scss'
})
export class AppUpdatesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private fb = inject(FormBuilder);
  private service = inject(ControlCenterService);

  readonly messageMax = MESSAGE_MAX;

  currentLang = this.translate.currentLang || 'ar';
  selectedApp: ControlCenterApp = 'client';
  selectedPlatform: ControlCenterPlatform = 'ios';

  loading = false;
  loadError = false;
  saving = false;
  /** Last loaded/saved copy — "cancel" restores it. */
  private saved: AppVersionSettings | null = null;
  private request?: Subscription;

  readonly appOptions: { value: ControlCenterApp; labelKey: string }[] = [
    { value: 'client', labelKey: 'd3.controlCenter.apps.client' },
    { value: 'merchant', labelKey: 'd3.controlCenter.apps.merchant' },
  ];

  readonly platformOptions: { value: ControlCenterPlatform; labelKey: string }[] = [
    { value: 'ios', labelKey: 'd3.controlCenter.platforms.ios' },
    { value: 'android', labelKey: 'd3.controlCenter.platforms.android' },
  ];

  readonly policyOptions: { value: UpdatePolicy; labelKey: string; descKey: string }[] = [
    { value: 'forced', labelKey: 'd3.controlCenter.updates.policies.forced', descKey: 'd3.controlCenter.updates.policies.forcedDesc' },
    { value: 'optional', labelKey: 'd3.controlCenter.updates.policies.optional', descKey: 'd3.controlCenter.updates.policies.optionalDesc' },
    { value: 'none', labelKey: 'd3.controlCenter.updates.policies.none', descKey: 'd3.controlCenter.updates.policies.noneDesc' },
  ];

  readonly form = this.fb.nonNullable.group({
    latestVersion: ['', [Validators.required, Validators.pattern(VERSION_PATTERN)]],
    minSupportedVersion: ['', [Validators.required, Validators.pattern(VERSION_PATTERN)]],
    policy: this.fb.nonNullable.control<UpdatePolicy>('forced'),
    storeUrl: ['', [Validators.required, Validators.pattern(/^https:\/\/\S+$/)]],
    message: ['', [Validators.required, Validators.maxLength(MESSAGE_MAX)]],
  }, { validators: versionOrderValidator });

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });
  }

  ngOnInit(): void {
    this.load();
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  // ── Target selection ────────────────────────────────────────

  selectApp(app: ControlCenterApp): void {
    if (app === this.selectedApp || this.saving) return;
    this.selectedApp = app;
    this.load();
  }

  selectPlatform(platform: ControlCenterPlatform): void {
    if (platform === this.selectedPlatform || this.saving) return;
    this.selectedPlatform = platform;
    this.load();
  }

  setPolicy(policy: UpdatePolicy): void {
    const control = this.form.controls.policy;
    if (control.value === policy) return;
    control.setValue(policy);
    control.markAsDirty();
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading = true;
    this.loadError = false;
    this.request = this.service.getVersionSettings(this.selectedApp, this.selectedPlatform).subscribe({
      next: settings => {
        this.apply(settings);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  // ── Validation ──────────────────────────────────────────────

  fieldError(name: 'latestVersion' | 'minSupportedVersion' | 'storeUrl' | 'message'): string | null {
    const control = this.form.controls[name];
    if (!control.touched) return null;
    if (control.hasError('required')) return 'd3.controlCenter.updates.errors.required';
    if (control.hasError('pattern')) {
      return name === 'storeUrl' ? 'd3.controlCenter.updates.errors.url' : 'd3.controlCenter.updates.errors.version';
    }
    if (name === 'minSupportedVersion' && this.form.hasError('versionOrder')) return 'd3.controlCenter.updates.errors.versionOrder';
    return null;
  }

  get canSave(): boolean {
    return this.form.dirty && !this.saving && !this.loading;
  }

  onCancel(): void {
    if (this.saved) this.apply(this.saved);
  }

  onSave(): void {
    if (!this.canSave) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastr.error(this.translate.instant('d3.toast.fillAllRequired'));
      return;
    }

    const v = this.form.getRawValue();
    const body: AppVersionSettings = {
      app: this.selectedApp,
      platform: this.selectedPlatform,
      latestVersion: v.latestVersion.trim(),
      minSupportedVersion: v.minSupportedVersion.trim(),
      policy: v.policy,
      storeUrl: v.storeUrl.trim(),
      message: v.message.trim(),
    };

    this.saving = true;
    this.service.saveVersionSettings(body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: settings => {
        this.saving = false;
        this.apply(settings);
        this.toastr.success(this.translate.instant('d3.controlCenter.updates.saveSuccess'));
      },
      error: () => {
        this.saving = false;
        this.toastr.error(this.translate.instant('d3.toast.saveError'));
      },
    });
  }

  private apply(settings: AppVersionSettings): void {
    this.saved = settings;
    this.form.reset({
      latestVersion: settings.latestVersion,
      minSupportedVersion: settings.minSupportedVersion,
      policy: settings.policy,
      storeUrl: settings.storeUrl,
      message: settings.message,
    });
  }

  // ── Preview ─────────────────────────────────────────────────

  get policy(): UpdatePolicy {
    return this.form.controls.policy.value;
  }

  /** Shown in the note under the phone; falls back to the saved value while the field is invalid. */
  get minVersionLabel(): string {
    const value = this.form.controls.minSupportedVersion.value.trim();
    return VERSION_PATTERN.test(value) ? value : (this.saved?.minSupportedVersion ?? '');
  }
}
