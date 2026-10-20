import { Component, DestroyRef, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { LoginService } from '../../../services/login/login.service';
import {
  API_PLATFORM, ControlCenterApp, ControlCenterPlatform, ReleaseConfig, SaveReleaseRequest, UpdatePolicy,
  VERSION_PATTERN, VersionImpact, compareVersions,
} from '../interfaces/control-center.model';
import { ControlCenterError, parseControlCenterError } from '../interfaces/control-center-error.util';
import { APP_RUNTIME_PERMISSIONS, hasAppRuntimePermission } from '../interfaces/control-center-permissions';
import { ControlCenterService } from '../services/control-center.service';
import { PhoneFrameComponent } from '../phone-frame/phone-frame.component';

const MESSAGE_MAX = 1000;
const STORE_URL = /^(https?|itms-apps|market):\/\/\S+$/i;
const IMPACT_DEBOUNCE_MS = 500;

/** Min can't exceed latest, and "Forced" needs a minimum to enforce. */
function releaseValidator(group: AbstractControl): ValidationErrors | null {
  const { latestVersion, minSupportedVersion, policy } = group.value as {
    latestVersion: string; minSupportedVersion: string; policy: UpdatePolicy;
  };
  const min = (minSupportedVersion ?? '').trim();
  const latest = (latestVersion ?? '').trim();
  if (policy === 'Forced' && !min) return { minRequired: true };
  if (VERSION_PATTERN.test(min) && VERSION_PATTERN.test(latest) && compareVersions(min, latest) > 0) return { versionOrder: true };
  return null;
}

type FieldName = 'latestVersion' | 'minSupportedVersion' | 'storeUrl' | 'message';

/** Maps form fields to the API's field names (camelCased from errors[].field). */
const SERVER_FIELD: Record<FieldName, string> = {
  latestVersion: 'latestVersion',
  minSupportedVersion: 'minSupportedVersion',
  storeUrl: 'storeUrl',
  message: 'updateMessageAr',
};

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
  private login = inject(LoginService);
  private service = inject(ControlCenterService);

  /** Fires after a successful save, so the page can refresh the summary. */
  @Output() saved = new EventEmitter<void>();

  readonly messageMax = MESSAGE_MAX;

  currentLang = this.translate.currentLang || 'ar';
  selectedApp: ControlCenterApp = 'client';
  selectedPlatform: ControlCenterPlatform = 'ios';

  loading = false;
  /** Why the releases couldn't be read (null = no error). */
  loadError: string | null = null;
  saving = false;
  serverError: ControlCenterError | null = null;

  /** Impact of the minimum currently typed (null = unchanged / not checked). */
  impact: VersionImpact | null = null;
  impactLoading = false;

  /** All platforms of the selected app, so switching OS needs no new request. */
  private releases: ReleaseConfig[] = [];
  /** The stored record for the selected platform — "cancel" restores it. */
  private current: ReleaseConfig | null = null;
  private request?: Subscription;
  private impact$ = new Subject<string>();

  readonly appOptions: { value: ControlCenterApp; labelKey: string }[] = [
    { value: 'client', labelKey: 'd3.controlCenter.apps.Client' },
    { value: 'host', labelKey: 'd3.controlCenter.apps.Host' },
  ];

  readonly platformOptions: { value: ControlCenterPlatform; labelKey: string }[] = [
    { value: 'ios', labelKey: 'd3.controlCenter.platforms.Ios' },
    { value: 'android', labelKey: 'd3.controlCenter.platforms.Android' },
  ];

  readonly policyOptions: { value: UpdatePolicy; labelKey: string; descKey: string }[] = [
    { value: 'Forced', labelKey: 'd3.controlCenter.updates.policies.forced', descKey: 'd3.controlCenter.updates.policies.forcedDesc' },
    { value: 'Optional', labelKey: 'd3.controlCenter.updates.policies.optional', descKey: 'd3.controlCenter.updates.policies.optionalDesc' },
  ];

  readonly form = this.fb.nonNullable.group({
    latestVersion: ['', [Validators.required, Validators.pattern(VERSION_PATTERN)]],
    minSupportedVersion: ['', Validators.pattern(VERSION_PATTERN)],
    policy: this.fb.nonNullable.control<UpdatePolicy>('Optional'),
    storeUrl: ['', Validators.pattern(STORE_URL)],
    message: ['', Validators.maxLength(MESSAGE_MAX)],
  }, { validators: releaseValidator });

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { this.serverError = null; });

    this.form.controls.minSupportedVersion.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.impact$.next(value.trim()));

    // Before saving, show how many installs a new minimum would lock out.
    this.impact$
      .pipe(
        debounceTime(IMPACT_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap(min => {
          const saved = this.current?.minSupportedVersion ?? '';
          if (!VERSION_PATTERN.test(min) || min === saved) {
            this.impactLoading = false;
            return of(null);
          }
          this.impactLoading = true;
          return this.service.getVersionImpact(this.selectedApp, this.selectedPlatform, min).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(impact => {
        this.impact = impact;
        this.impactLoading = false;
      });
  }

  ngOnInit(): void {
    this.load();
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get canManage(): boolean {
    return hasAppRuntimePermission(this.login, APP_RUNTIME_PERMISSIONS.manageReleases);
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
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
    this.applyPlatform();
  }

  setPolicy(policy: UpdatePolicy): void {
    const control = this.form.controls.policy;
    if (control.value === policy || !this.canManage) return;
    control.setValue(policy);
    control.markAsDirty();
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading = true;
    this.loadError = null;
    this.request = this.service.getReleases(this.selectedApp).subscribe({
      next: rows => {
        this.releases = rows.filter(r => r.platform === 'Android' || r.platform === 'Ios');
        this.applyPlatform();
        this.loading = false;
      },
      error: err => {
        this.loading = false;
        this.loadError = parseControlCenterError(err, this.translate).message;
      },
    });
  }

  private applyPlatform(): void {
    this.current = this.releases.find(r => r.platform === API_PLATFORM[this.selectedPlatform]) ?? null;
    this.apply(this.current);
  }

  /** An unconfigured platform (`id: null`) starts empty. */
  private apply(r: ReleaseConfig | null): void {
    const configured = !!r?.id;
    this.form.reset({
      latestVersion: configured ? r!.latestVersion ?? '' : '',
      minSupportedVersion: configured ? r!.minSupportedVersion ?? '' : '',
      policy: configured && r!.enforceMinVersionOnServer ? 'Forced' : 'Optional',
      storeUrl: configured ? r!.storeUrl ?? '' : '',
      message: configured ? r!.updateMessageAr ?? '' : '',
    }, { emitEvent: false });
    if (this.canManage) this.form.enable({ emitEvent: false });
    else this.form.disable({ emitEvent: false });
    this.impact = null;
    this.impactLoading = false;
    this.serverError = null;
  }

  get isConfigured(): boolean {
    return !!this.current?.id;
  }

  // ── Validation ──────────────────────────────────────────────

  fieldError(name: FieldName): string | null {
    const server = this.serverError?.fieldErrors[SERVER_FIELD[name]];
    if (server) return server;
    const control = this.form.controls[name];
    if (!control.touched) return null;
    if (control.hasError('required')) return this.translate.instant('d3.controlCenter.updates.errors.required');
    if (control.hasError('pattern')) {
      return this.translate.instant(name === 'storeUrl' ? 'd3.controlCenter.updates.errors.url' : 'd3.controlCenter.updates.errors.version');
    }
    if (name === 'minSupportedVersion') {
      if (this.form.hasError('minRequired')) return this.translate.instant('d3.controlCenter.updates.errors.minRequired');
      if (this.form.hasError('versionOrder')) return this.translate.instant('d3.controlCenter.updates.errors.versionOrder');
    }
    return null;
  }

  /** The server message when no field claims it (e.g. VALIDATION_ERROR). */
  get generalError(): string | null {
    if (!this.serverError) return null;
    const claimed = Object.values(SERVER_FIELD).some(f => this.serverError!.fieldErrors[f]);
    return claimed ? null : this.serverError.message;
  }

  // ── Save ────────────────────────────────────────────────────

  get canSave(): boolean {
    return this.canManage && this.form.dirty && !this.saving && !this.loading;
  }

  onCancel(): void {
    this.apply(this.current);
  }

  onSave(): void {
    if (!this.canSave) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // The whole form is sent — safe with the API's partial update; "" clears a text field.
    const v = this.form.getRawValue();
    const body: SaveReleaseRequest = {
      latestVersion: v.latestVersion.trim(),
      minSupportedVersion: v.minSupportedVersion.trim(),
      updatePolicy: v.policy,
      storeUrl: v.storeUrl.trim(),
      updateMessageAr: v.message.trim(),
    };

    this.saving = true;
    this.serverError = null;
    this.service.saveRelease(this.selectedApp, this.selectedPlatform, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: saved => {
        this.saving = false;
        this.releases = this.releases.map(r => (r.platform === saved.platform ? saved : r));
        this.current = saved;
        this.apply(saved);
        this.toastr.success(this.translate.instant('d3.controlCenter.updates.saveSuccess'));
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

  // ── Preview ─────────────────────────────────────────────────

  get policy(): UpdatePolicy {
    return this.form.controls.policy.value;
  }

  get minVersionLabel(): string {
    const value = this.form.controls.minSupportedVersion.value.trim();
    return VERSION_PATTERN.test(value) ? value : '';
  }

  /** Opens the typed store link — the preview's "Update now" mirrors what the app does. */
  openStore(): void {
    const url = this.form.controls.storeUrl.value.trim();
    if (STORE_URL.test(url) && /^https?:/i.test(url)) window.open(url, '_blank', 'noopener');
  }
}
