import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { CoreService } from 'src/app/services/core.service';
import { AdminNotificationsStore } from '../../services/admin-notifications-store.service';
import { AdminNotification, NotificationCategory } from '../../interfaces/admin-notification.model';
import {
  NOTIFICATION_CATEGORIES,
  categoryOf,
  iconOf,
  isKnownType,
  relativeTime,
  routeFor,
  severityOf,
} from './notification-presentation';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, TranslateModule, MaterialModule, TablerIconsModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit {
  readonly store = inject(AdminNotificationsStore);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private settings = inject(CoreService);
  private destroyRef = inject(DestroyRef);

  readonly categories = NOTIFICATION_CATEGORIES;
  readonly activeCategory = signal<NotificationCategory>('all');

  private readonly lang = computed(() => this.settings.getOptionsSignal()().language);
  readonly currentDir = computed(() => (this.lang() === 'en' ? 'ltr' : 'rtl'));

  // Ticks once a minute so "5 minutes ago" labels stay current while the page is open.
  private readonly now = signal(Date.now());

  // The API filters by one exact type while tabs group several, so categories are
  // filtered client-side over the pages loaded so far.
  readonly visibleNotifications = computed(() => {
    const category = this.activeCategory();
    const items = this.store.items();
    return category === 'all' ? items : items.filter(n => categoryOf(n.type) === category);
  });

  ngOnInit(): void {
    // Before the first load the shell's connect() already triggers the refresh.
    if (this.store.initialized()) this.store.refresh();

    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  setCategory(category: NotificationCategory): void {
    this.activeCategory.set(category);
  }

  open(item: AdminNotification): void {
    // Fire-and-forget: a failed mark-as-read must not block navigation.
    this.store.markAsRead(item.id);
    const route = routeFor(item);
    if (route) this.router.navigate([`/${this.lang()}`, 'd3', ...route]);
  }

  async remove(item: AdminNotification, event: Event): Promise<void> {
    event.stopPropagation();
    const ok = await this.store.delete(item.id);
    if (!ok) this.toastr.error(this.translate.instant('d3.toast.errorOp'));
  }

  async markAllAsRead(): Promise<void> {
    const ok = await this.store.markAllAsRead();
    if (!ok) this.toastr.error(this.translate.instant('d3.toast.errorOp'));
  }

  retry(): void {
    this.store.refresh();
  }

  typeLabelKey(type: string): string {
    return isKnownType(type) ? `d3.notifications.types.${type}` : 'd3.notifications.types.default';
  }

  iconName(type: string): string {
    return iconOf(type);
  }

  severityClass(type: string): string {
    return `severity-${severityOf(type)}`;
  }

  timeLabel(item: AdminNotification): string {
    return relativeTime(item.createdAt, this.lang(), this.now());
  }

  hasDestination(item: AdminNotification): boolean {
    return routeFor(item) !== null;
  }
}
