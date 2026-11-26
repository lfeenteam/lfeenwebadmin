import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { MaterialModule } from 'src/app/material.module';
import { CoreService } from 'src/app/services/core.service';
import { LoginService } from 'src/app/pages/dashboards/dashboard3/services/login/login.service';
import { AdminNotificationsStore } from 'src/app/pages/dashboards/dashboard3/services/admin-notifications-store.service';
import { NotificationNavigator } from 'src/app/pages/dashboards/dashboard3/services/notification-navigator.service';
import { AdminNotification } from 'src/app/pages/dashboards/dashboard3/interfaces/admin-notification.model';
import {
  iconOf,
  isKnownType,
  relativeTime,
  severityOf,
} from 'src/app/pages/dashboards/dashboard3/pages-d3/notifications/notification-presentation';
import { userInitials } from 'src/app/pages/dashboards/dashboard3/utils/user-initials.util';
import { D3IconComponent } from '../d3-icon/d3-icon.component';

interface AppLanguage {
  language: string;
  code: string;
  icon: string;
}

/** How many of the latest notifications the dropdown lists. */
const DROPDOWN_LIMIT = 6;

/**
 * The account cluster at the end of every page header: notifications (badge + dropdown),
 * language, and the account menu (profile, sign out). One component, so the executive
 * dashboard header and every other page's header behave identically — the sidebar no
 * longer repeats any of it.
 */
@Component({
  selector: 'app-d3-header-actions',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, D3IconComponent],
  templateUrl: './header-actions.component.html',
  styleUrl: './header-actions.component.scss',
})
export class HeaderActionsComponent {
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly settings = inject(CoreService);
  private readonly toastr = inject(ToastrService);
  private readonly navigator = inject(NotificationNavigator);
  readonly loginService = inject(LoginService);
  readonly notificationsStore = inject(AdminNotificationsStore);

  readonly languages: AppLanguage[] = [
    { language: 'العربية', code: 'ar', icon: '/assets/images/flag/icon-flag-es.svg' },
    { language: 'English', code: 'en', icon: '/assets/images/flag/icon-flag-en.svg' },
  ];

  readonly user = this.loginService.currentUser;
  readonly initials = computed(() => userInitials(this.user()?.fullName));
  readonly displayName = computed(() => this.user()?.fullName || this.user()?.email || '');
  readonly displayRole = computed(() => {
    const roles = this.user()?.roles;
    return Array.isArray(roles) ? roles.join(', ') : (roles || '');
  });

  private readonly lang = computed(() => this.settings.getOptionsSignal()().language);
  readonly isRtl = computed(() => this.lang() !== 'en');

  /** Relative times ("5 minutes ago") re-read once a minute while the page is open. */
  private readonly now = signal(Date.now());
  readonly latest = computed(() => this.notificationsStore.items().slice(0, DROPDOWN_LIMIT));
  readonly openingId = this.navigator.openingId;

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  // Read live: a language switch only changes the :lang param, so this component is reused.
  get selectedLanguage(): AppLanguage {
    const code = this.lang();
    return this.languages.find(l => l.code === code) || this.languages[0];
  }

  unreadBadge(): string {
    const n = this.notificationsStore.unreadCount();
    return n > 99 ? '+99' : String(n);
  }

  // ── Notifications dropdown ──
  onNotificationsOpened(): void {
    // A failed list load stays on screen as an error state — opening the menu retries it.
    const store = this.notificationsStore;
    if (store.listError() && !store.loading()) store.refresh();
  }

  openNotification(item: AdminNotification): void {
    if (!this.navigator.open(item)) {
      // No screen for this type — the inbox page still shows it in full.
      this.navigateTo('notifications');
    }
  }

  async markAllAsRead(event: Event): Promise<void> {
    // Keep the menu open so the admin sees the items flip to read.
    event.stopPropagation();
    const ok = await this.notificationsStore.markAllAsRead();
    if (!ok) this.toastr.error(this.translate.instant('d3.toast.errorOp'));
  }

  retryNotifications(event: Event): void {
    event.stopPropagation();
    this.notificationsStore.refresh();
  }

  notificationIcon(type: string): string {
    return iconOf(type);
  }

  severityClass(type: string): string {
    return `sev-${severityOf(type)}`;
  }

  typeLabelKey(type: string): string {
    return isKnownType(type) ? `d3.notifications.types.${type}` : 'd3.notifications.types.default';
  }

  timeLabel(item: AdminNotification): string {
    return relativeTime(item.createdAt, this.lang(), this.now());
  }

  // ── Language / account ──
  changeLanguage(lang: AppLanguage): void {
    const dir = lang.code === 'ar' ? 'rtl' : 'ltr';
    this.settings.setOptions({ language: lang.code, dir }, true);
    this.translate.use(lang.code);

    const urlSegments = this.router.url.split('/').filter(Boolean);
    if (urlSegments.length > 0 && this.languages.some(l => l.code === urlSegments[0])) {
      urlSegments[0] = lang.code;
    } else {
      urlSegments.unshift(lang.code);
    }
    this.router.navigateByUrl('/' + urlSegments.join('/'));
  }

  private langPrefix(): string {
    const urlSegments = this.router.url.split('/').filter(Boolean);
    return urlSegments.length > 0 && this.languages.some(l => l.code === urlSegments[0])
      ? urlSegments[0]
      : (this.selectedLanguage.code || 'ar');
  }

  navigateTo(page: 'profile' | 'notifications'): void {
    this.router.navigateByUrl(`/${this.langPrefix()}/d3/${page}`);
  }

  logout(): void {
    const lang = this.langPrefix();
    this.loginService.logout();
    this.router.navigateByUrl(`/${lang}/d3/login`);
  }
}
