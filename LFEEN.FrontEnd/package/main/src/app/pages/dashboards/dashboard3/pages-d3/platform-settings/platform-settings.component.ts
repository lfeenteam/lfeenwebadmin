import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MaterialModule } from 'src/app/material.module';
import { Subscription } from 'rxjs';
import { LoginService } from '../../services/login/login.service';
import { PlatformSettingsService } from '../../services/platform-settings.service';
import {
  PlatformGeneralSettings,
  PlatformNotificationSetting,
  SETTINGS_PERMISSIONS,
  TIME_ZONE_OPTIONS,
  UpdatePlatformGeneralSettings,
  hasSettingsPermission,
} from '../../interfaces/platform-settings.model';

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
  private langSub?: Subscription;
  private generalSub?: Subscription;
  private notifSub?: Subscription;

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
