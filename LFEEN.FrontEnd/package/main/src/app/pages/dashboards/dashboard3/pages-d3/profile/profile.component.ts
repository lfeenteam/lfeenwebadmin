import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MaterialModule } from 'src/app/material.module';
import { MatDialog } from '@angular/material/dialog';
import { LoginService } from '../../services/login/login.service';
import { PlatformSettingsService } from '../../services/platform-settings.service';
import { AdminNotificationsStore } from '../../services/admin-notifications-store.service';
import { NotificationKeys, UserNotificationPreference } from '../../interfaces/platform-settings.model';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastrService);
  private settingsApi = inject(PlatformSettingsService);
  private notificationsStore = inject(AdminNotificationsStore);
  private destroyRef = inject(DestroyRef);
  loginService = inject(LoginService);

  readonly preferences = signal<UserNotificationPreference[]>([]);
  readonly prefsLoading = signal(false);
  readonly prefsError = signal(false);
  /** Keys with a PUT in flight — their toggles stay disabled to avoid double submits. */
  readonly savingKeys = signal<ReadonlySet<string>>(new Set());

  private loadSub?: Subscription;

  ngOnInit(): void {
    this.loadPreferences();
    // title/description come localized from Accept-Language.
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadPreferences());
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get interfaceLanguage(): string {
    return this.translate.currentLang === 'en' ? 'English' : 'العربية';
  }

  loadPreferences(): void {
    this.loadSub?.unsubscribe();
    this.prefsLoading.set(true);
    this.prefsError.set(false);
    this.loadSub = this.settingsApi.getMyNotificationPreferences().subscribe({
      next: list => {
        this.applyPreferences(list);
        this.prefsLoading.set(false);
      },
      error: () => {
        this.prefsError.set(true);
        this.prefsLoading.set(false);
      },
    });
  }

  isSaving(key: string): boolean {
    return this.savingKeys().has(key);
  }

  onToggle(pref: UserNotificationPreference, isEnabled: boolean): void {
    if (this.isSaving(pref.key) || !pref.isPlatformEnabled) return;

    const previous = pref.isEnabled;
    this.patch(pref.key, { isEnabled, isEffective: isEnabled && pref.isPlatformEnabled });
    this.setSaving(pref.key, true);
    // Stop alerts in this tab immediately rather than waiting for the next event.
    if (pref.key === NotificationKeys.BrowserRealtime) {
      this.notificationsStore.browserAlertsEnabled.set(isEnabled && pref.isPlatformEnabled);
    }

    this.settingsApi
      .updateMyNotificationPreferences({ items: [{ key: pref.key, isEnabled }] })
      .subscribe({
        next: list => {
          this.applyPreferences(list);
          this.setSaving(pref.key, false);
        },
        error: (err: HttpErrorResponse) => {
          this.patch(pref.key, { isEnabled: previous, isEffective: previous && pref.isPlatformEnabled });
          if (pref.key === NotificationKeys.BrowserRealtime) {
            this.notificationsStore.browserAlertsEnabled.set(previous && pref.isPlatformEnabled);
          }
          this.setSaving(pref.key, false);
          this.toastr.error(err.error?.message || this.translate.instant('d3.toast.errorOp'));
        },
      });
  }

  async openChangePassword(): Promise<void> {
    const { ChangePasswordDialogComponent } = await import(
      './components/change-password-dialog/change-password-dialog.component'
    );
    this.dialog.open(ChangePasswordDialogComponent, {
      width: '420px',
      panelClass: 'change-password-dialog-panel',
      direction: this.currentDir
    });
  }

  private applyPreferences(list: UserNotificationPreference[]): void {
    this.preferences.set(list);
    const browser = list.find(p => p.key === NotificationKeys.BrowserRealtime);
    if (browser) this.notificationsStore.browserAlertsEnabled.set(browser.isEffective);
  }

  private patch(key: string, changes: Partial<UserNotificationPreference>): void {
    this.preferences.update(list => list.map(p => (p.key === key ? { ...p, ...changes } : p)));
  }

  private setSaving(key: string, saving: boolean): void {
    this.savingKeys.update(set => {
      const next = new Set(set);
      if (saving) next.add(key);
      else next.delete(key);
      return next;
    });
  }
}
