import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MaterialModule } from 'src/app/material.module';
import { Subscription } from 'rxjs';
import { formatAppNumber } from 'src/app/utils/locale-format.util';
import { LoginService } from '../../services/login/login.service';
import { PlatformSettingsService } from '../../services/platform-settings.service';
import {
  PlatformGeneralSettings,
  PlatformNotificationSetting,
  REVIEW_REWARD_LIMITS,
  ReviewRewardSettings,
  SETTINGS_PERMISSIONS,
  TIME_ZONE_OPTIONS,
  UpdatePlatformGeneralSettings,
  hasSettingsPermission,
} from '../../interfaces/platform-settings.model';
import { ReviewConfirmDialogComponent } from '../build-review/review-confirm-dialog/review-confirm-dialog.component';

type GeneralField = keyof UpdatePlatformGeneralSettings;

// Backend validation field → form input ("Request.PlatformName" → "platformName").
const GENERAL_FIELD_MAP: Record<string, GeneralField> = {
  'request.platformname': 'platformName',
  'request.platformurl': 'platformUrl',
  'request.supportemail': 'supportEmail',
  'request.timezone': 'timeZone',
};

interface ActiveSession {
  id: string;
  name: string;
  deviceIcon: string;
  location: string;
  browser: string;
  isCurrent: boolean;
  time?: string;
}

interface LoginLog {
  event: string;
  dateTime: string;
  ip: string;
  location: string;
  type: 'success' | 'warning' | 'error';
}

@Component({
  selector: 'app-platform-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule],
  templateUrl: './platform-settings.component.html',
  styleUrl: './platform-settings.component.scss'
})
export class PlatformSettingsComponent implements OnInit, OnDestroy {
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);
  private toastr = inject(ToastrService);
  private api = inject(PlatformSettingsService);
  private login = inject(LoginService);
  private dialog = inject(MatDialog);
  private langSub?: Subscription;
  private generalSub?: Subscription;
  private notifSub?: Subscription;
  private rewardSub?: Subscription;

  showLogTable = true;

  activeTab: 'sysInfo' | 'security' = 'sysInfo';

  /** Settings.View without Settings.Manage → everything read-only, no Save button. */
  readonly canManage = computed(() => hasSettingsPermission(this.login, SETTINGS_PERMISSIONS.manage));

  // System info — GET/PUT /api/settings/general
  form: UpdatePlatformGeneralSettings = { platformName: '', platformUrl: '', supportEmail: '', timeZone: '' };
  readonly generalUpdatedAt = signal<string | null>(null);
  readonly generalLoading = signal(false);
  readonly generalError = signal(false);
  readonly saving = signal(false);
  fieldErrors: Partial<Record<GeneralField, string>> = {};

  // Platform notification switches — GET/PUT /api/settings/notifications
  readonly notifications = signal<PlatformNotificationSetting[]>([]);
  readonly notifLoading = signal(false);
  readonly notifError = signal(false);
  readonly notifCardError = signal<string | null>(null);
  readonly savingKeys = signal<ReadonlySet<string>>(new Set());

  // Stay-review cashback — GET/PUT /api/settings/review-reward
  readonly rewardLimits = REVIEW_REWARD_LIMITS;
  readonly reward = signal<ReviewRewardSettings | null>(null);
  readonly rewardLoading = signal(false);
  readonly rewardError = signal(false);
  /** 403 on GET (permission removed mid-session) → the card is hidden. */
  readonly rewardForbidden = signal(false);
  readonly rewardSaving = signal(false);
  rewardEnabled = false;
  rewardAmount: number | null = null;
  rewardFieldError: string | null = null;
  // Off is stored as 0, so remember the last amount above 0 to refill the field when switched back on.
  private lastRewardAmount: number = REVIEW_REWARD_LIMITS.defaultAmount;

  // Security — 2FA, sessions and the login log below are sample data with no API
  // behind them, so the tab shows "coming soon" until this is wired.
  readonly securityReady = false;
  twoFaEnabled = true;

  activeSessions: ActiveSession[] = [
    {
      id: '1',
      name: 'MacBook Pro',
      deviceIcon: 'device-laptop',
      location: 'الرياض، المملكة العربية السعودية',
      browser: 'Chrome',
      isCurrent: true
    },
    {
      id: '2',
      name: 'iPhone 15 Pro',
      deviceIcon: 'device-mobile',
      location: 'الرياض، المملكة العربية السعودية',
      browser: 'تطبيق لفين',
      isCurrent: false,
      time: 'منذ يومين'
    }
  ];

  loginLogs: LoginLog[] = [
    {
      event: 'تسجيل دخول ناجح',
      dateTime: '٨ أكتوبر ٢٠٢٤ ص ٩:٤٥',
      ip: '92.168.1.45',
      location: 'SA الرياض',
      type: 'success'
    },
    {
      event: 'تغيير كلمة المرور',
      dateTime: '٨ أكتوبر ٢٠٢٤ م ١:١٥',
      ip: '92.168.1.45',
      location: 'SA الرياض',
      type: 'warning'
    },
    {
      event: 'فشل تسجيل الدخول',
      dateTime: '٨ أكتوبر ٢٠٢٤ م ١٢:٣٠',
      ip: '104.21.4.12',
      location: 'UK لندن',
      type: 'error'
    }
  ];

  logColumns = ['event', 'dateTime', 'ip', 'location'];

  ngOnInit(): void {
    this.loadGeneral();
    this.loadNotifications();
    this.loadReviewReward();
    this.langSub = this.translate.onLangChange.subscribe(() => {
      // Notification titles/descriptions come localized from Accept-Language.
      this.loadNotifications();
      this.showLogTable = false;
      setTimeout(() => {
        this.showLogTable = true;
        this.cdr.detectChanges();
      }, 0);
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.generalSub?.unsubscribe();
    this.notifSub?.unsubscribe();
    this.rewardSub?.unsubscribe();
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  /** Static list, plus the saved id if it isn't in it so the select never shows blank. */
  get timeZoneOptions(): { id: string; label: string }[] {
    const en = this.translate.currentLang === 'en';
    const options = TIME_ZONE_OPTIONS.map(tz => ({
      id: tz.id,
      label: `(GMT${tz.offset}) ${en ? tz.labelEn : tz.labelAr}`,
    }));
    if (this.form.timeZone && !options.some(o => o.id === this.form.timeZone)) {
      options.unshift({ id: this.form.timeZone, label: this.form.timeZone });
    }
    return options;
  }

  loadGeneral(): void {
    this.generalSub?.unsubscribe();
    this.generalLoading.set(true);
    this.generalError.set(false);
    this.generalSub = this.api.getGeneral().subscribe({
      next: res => {
        this.fillForm(res);
        this.generalLoading.set(false);
      },
      error: () => {
        this.generalError.set(true);
        this.generalLoading.set(false);
      },
    });
  }

  loadNotifications(): void {
    this.notifSub?.unsubscribe();
    this.notifLoading.set(true);
    this.notifError.set(false);
    this.notifSub = this.api.getPlatformNotifications().subscribe({
      next: list => {
        this.notifications.set(list);
        this.notifLoading.set(false);
      },
      error: () => {
        this.notifError.set(true);
        this.notifLoading.set(false);
      },
    });
  }

  clearFieldError(field: GeneralField): void {
    if (this.fieldErrors[field]) this.fieldErrors = { ...this.fieldErrors, [field]: undefined };
  }

  isSavingKey(key: string): boolean {
    return this.savingKeys().has(key);
  }

  onToggleNotification(row: PlatformNotificationSetting, isEnabled: boolean): void {
    if (!this.canManage() || this.isSavingKey(row.key)) return;

    const previous = row.isEnabled;
    this.patchNotification(row.key, { isEnabled });
    this.setSavingKey(row.key, true);
    this.notifCardError.set(null);

    this.api.updatePlatformNotifications({ items: [{ key: row.key, isEnabled }] }).subscribe({
      next: list => {
        this.notifications.set(list);
        this.setSavingKey(row.key, false);
      },
      error: (err: HttpErrorResponse) => {
        this.patchNotification(row.key, { isEnabled: previous });
        this.setSavingKey(row.key, false);
        const message = this.errorMessage(err);
        this.notifCardError.set(message);
        this.toastr.error(message);
      },
    });
  }

  setTab(tab: 'sysInfo' | 'security'): void {
    this.activeTab = tab;
  }

  onSave(): void {
    if (!this.canManage() || this.saving()) return;

    // Full replace: all four fields every time.
    const body: UpdatePlatformGeneralSettings = {
      platformName: this.form.platformName.trim(),
      platformUrl: this.form.platformUrl.trim(),
      supportEmail: this.form.supportEmail.trim(),
      timeZone: this.form.timeZone,
    };
    this.fieldErrors = {};
    this.saving.set(true);

    this.api.updateGeneral(body).subscribe({
      next: res => {
        this.fillForm(res);
        this.saving.set(false);
        this.toastr.success(this.translate.instant('d3.toast.successOp'));
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        const errors: { field?: string; message?: string }[] = Array.isArray(err.error?.errors) ? err.error.errors : [];
        const mapped: Partial<Record<GeneralField, string>> = {};
        for (const e of errors) {
          const field = GENERAL_FIELD_MAP[(e.field ?? '').toLowerCase()];
          if (field && e.message && !mapped[field]) mapped[field] = e.message;
        }
        this.fieldErrors = mapped;
        this.toastr.error(this.errorMessage(err));
      },
    });
  }

  loadReviewReward(): void {
    this.rewardSub?.unsubscribe();
    this.rewardLoading.set(true);
    this.rewardError.set(false);
    this.rewardSub = this.api.getReviewReward().subscribe({
      next: res => {
        this.fillReward(res);
        this.rewardLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 403) this.rewardForbidden.set(true);
        else this.rewardError.set(true);
        this.rewardLoading.set(false);
      },
    });
  }

  /** True while the field differs from the last saved value. */
  get rewardDirty(): boolean {
    const saved = this.reward();
    if (!saved) return false;
    return this.rewardEnabled !== saved.isEnabled || (this.rewardAmount ?? 0) !== saved.amountSar;
  }

  /** Live while typing; the server's value once the field matches what was saved. */
  get rewardPoints(): number | null {
    const saved = this.reward();
    if (!saved) return null;
    if (!this.rewardDirty) return saved.points;
    const amount = this.rewardAmount;
    if (amount === null || !isFinite(amount) || !(saved.pointsToSarRate > 0)) return null;
    // toFixed drops float noise (7.5 / 0.05 = 149.99999999999997) before rounding.
    return Math.round(Number((amount / saved.pointsToSarRate).toFixed(6)));
  }

  get rewardPointsLabel(): string {
    return formatAppNumber(this.rewardPoints, this.translate.currentLang);
  }

  onRewardAmountChange(): void {
    this.rewardFieldError = null;
  }

  onToggleReward(event: MatSlideToggleChange): void {
    if (!this.canManage() || this.rewardSaving()) {
      event.source.checked = this.rewardEnabled;
      return;
    }
    this.rewardFieldError = null;

    if (event.checked) {
      // Turning on only unlocks the field; the admin saves an amount above 0.
      this.rewardEnabled = true;
      if (!this.rewardAmount || this.rewardAmount <= 0) this.rewardAmount = this.lastRewardAmount;
      return;
    }

    // Switched on but never saved → nothing to send, just go back to the saved off state.
    if (!this.reward()?.isEnabled) {
      this.rewardEnabled = false;
      this.rewardAmount = 0;
      return;
    }

    // Off is saved right away and hits every client, so confirm first.
    const ref = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey: 'd3.settings.reviewReward.confirmOffTitle',
        messageKey: 'd3.settings.reviewReward.confirmOffMessage',
        confirmKey: 'd3.settings.reviewReward.confirmOffAction',
        tone: 'reject',
      },
    });
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) this.saveReward(0);
      else event.source.checked = true;
    });
  }

  onSaveReward(): void {
    if (!this.canManage() || this.rewardSaving() || !this.rewardEnabled) return;

    const amount = this.rewardAmount;
    const errorKey = this.rewardValidationKey(amount);
    if (errorKey) {
      this.rewardFieldError = this.translate.instant(errorKey, {
        min: REVIEW_REWARD_LIMITS.min,
        max: REVIEW_REWARD_LIMITS.max,
      });
      return;
    }
    this.saveReward(amount as number);
  }

  private saveReward(amountSar: number): void {
    this.rewardFieldError = null;
    this.rewardSaving.set(true);

    this.api.updateReviewReward({ amountSar }).subscribe({
      next: res => {
        this.fillReward(res);
        this.rewardSaving.set(false);
        this.toastr.success(this.translate.instant('d3.toast.successOp'));
      },
      error: (err: HttpErrorResponse) => {
        this.rewardSaving.set(false);

        if (err.status === 400) {
          const errors: { field?: string; message?: string }[] = Array.isArray(err.error?.errors) ? err.error.errors : [];
          const fieldMsg = errors.find(e => /amountsar$/i.test(e.field ?? '') && e.message)?.message;
          if (fieldMsg) {
            this.rewardFieldError = fieldMsg;
            return;
          }
        }

        // 409 (locked) / 502 (main backend down) / anything else → keep the old value.
        const saved = this.reward();
        if (saved) this.fillReward(saved);
        const message = err.status === 502
          ? this.translate.instant('d3.toast.errorOp')
          : this.errorMessage(err);
        this.toastr.error(message);
      },
    });
  }

  /** Mirrors the backend rules (0–1000, ≤ 2 decimals); above 0 while the switch is on. */
  private rewardValidationKey(amount: number | null): string | null {
    if (amount === null || amount === undefined || !isFinite(amount)) return 'd3.settings.reviewReward.errors.required';
    if (amount <= 0) return 'd3.settings.reviewReward.errors.aboveZero';
    if (amount > REVIEW_REWARD_LIMITS.max) return 'd3.settings.reviewReward.errors.range';
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return 'd3.settings.reviewReward.errors.decimals';
    return null;
  }

  private fillReward(res: ReviewRewardSettings): void {
    this.reward.set(res);
    this.rewardEnabled = res.isEnabled;
    this.rewardAmount = res.amountSar;
    if (res.amountSar > 0) this.lastRewardAmount = res.amountSar;
    this.rewardFieldError = null;
  }

  private fillForm(res: PlatformGeneralSettings): void {
    this.form = {
      platformName: res.platformName ?? '',
      platformUrl: res.platformUrl ?? '',
      supportEmail: res.supportEmail ?? '',
      timeZone: res.timeZone ?? '',
    };
    this.generalUpdatedAt.set(res.updatedAt);
    this.fieldErrors = {};
  }

  private errorMessage(err: HttpErrorResponse): string {
    if (err.status === 403) return this.translate.instant('d3.settings.errors.forbidden');
    return err.error?.message || this.translate.instant('d3.toast.errorOp');
  }

  private patchNotification(key: string, changes: Partial<PlatformNotificationSetting>): void {
    this.notifications.update(list => list.map(n => (n.key === key ? { ...n, ...changes } : n)));
  }

  private setSavingKey(key: string, saving: boolean): void {
    this.savingKeys.update(set => {
      const next = new Set(set);
      if (saving) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  logoutAll(): void {
    this.activeSessions = this.activeSessions.filter(s => s.isCurrent);
  }

  logoutSession(id: string): void {
    this.activeSessions = this.activeSessions.filter(s => s.id !== id);
  }
}
