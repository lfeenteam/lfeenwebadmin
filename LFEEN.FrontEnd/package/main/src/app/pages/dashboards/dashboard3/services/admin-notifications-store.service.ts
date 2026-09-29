import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { Subscription, firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CoreService } from 'src/app/services/core.service';import { LoginService } from './login/login.service';
import { AdminNotificationsService } from './admin-notifications.service';
import {
  AdminNotification,
  AdminNotificationRealtimeEvent,
} from '../interfaces/admin-notification.model';

const PAGE_SIZE = 20;
// Coming back to a tab hidden longer than this refreshes page 1 + unread count,
// since the browser may have throttled or dropped the hub connection meanwhile.
const STALE_AFTER_HIDDEN_MS = 2 * 60 * 1000;

function fromRealtime(event: AdminNotificationRealtimeEvent, lang: string): AdminNotification {
  const ar = lang === 'ar';
  return {
    id: event.id,
    type: event.type,
    title: ar ? event.titleAr : event.titleEn,
    body: ar ? event.bodyAr : event.bodyEn,
    isRead: event.isRead,
    readAt: null,
    createdAt: event.createdAt,
    referenceId: event.referenceId,
    referenceType: event.referenceType,
  };
}

/**
 * Per-admin notification inbox. REST is the source of truth; SignalR only
 * delivers live hints and never replays what was missed, so every
 * (re)connect, focus-after-suspension, and language switch re-reads page 1
 * and the unread count from the API.
 */
@Injectable({
  providedIn: 'root'
})
export class AdminNotificationsStore {
  private api = inject(AdminNotificationsService);
  private loginService = inject(LoginService);
  private settings = inject(CoreService);

  readonly items = signal<AdminNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly markingAll = signal(false);
  readonly listError = signal(false);
  readonly loadMoreError = signal(false);
  readonly forbidden = signal(false);
  readonly initialized = signal(false);

  private readonly page = signal(0);
  private readonly totalPages = signal(0);
  readonly hasMore = computed(() => this.page() < this.totalPages());

  private connection: signalR.HubConnection | null = null;
  private listSub: Subscription | null = null;
  private loadMoreSub: Subscription | null = null;
  private countSub: Subscription | null = null;
  // Live items that arrive while a page-1 refresh is in flight; merged back in
  // so a response computed just before the event doesn't drop them.
  private liveDuringRefresh: AdminNotification[] = [];
  private lang = this.settings.getLanguage() || 'ar';
  private hiddenAt: number | null = null;
  private countFailed = false;

  constructor() {
    this.loginService.loggingOut$.subscribe(() => this.disconnect());

    // REST items only carry the requested language, so a switch reloads them.
    effect(() => {
      const lang = this.settings.getOptionsSignal()().language;
      untracked(() => {
        if (lang === this.lang) return;
        this.lang = lang;
        if (this.connection) this.refresh();
      });
    });

    document.addEventListener('visibilitychange', () => this.onVisibilityChange());
  }

  connect(): void {
    if (this.connection) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiBaseUrl}/hubs/notifications`, {
        accessTokenFactory: () => this.loginService.getToken() ?? '',
      })
      .withAutomaticReconnect([0, 2_000, 10_000, 30_000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('ReceiveNotification', (event: AdminNotificationRealtimeEvent) => this.receive(event));
    connection.onreconnected(() => this.refresh());

    this.connection = connection;
    this.lang = this.settings.getLanguage() || 'ar';

    // Hub first, then REST, to shrink the window where an event could be created
    // between loading the list and listening. A failed hub start is non-blocking:
    // the REST inbox still works without live delivery.
    connection
      .start()
      .catch(() => undefined)
      .finally(() => {
        if (this.connection === connection) this.refresh();
      });
  }

  disconnect(): void {
    const connection = this.connection;
    this.connection = null;
    if (connection) {
      connection.off('ReceiveNotification');
      connection.stop().catch(() => undefined);
    }
    this.reset();
  }

  refresh(): void {
    this.refreshFirstPage();
    this.refreshUnreadCount();
  }

  refreshUnreadCount(): void {
    this.countSub?.unsubscribe();
    // On failure the last known badge stays; the next reconnect/focus retries.
    this.countSub = this.api.getUnreadCount().subscribe({
      next: res => {
        this.unreadCount.set(res.unreadCount);
        this.countFailed = false;
      },
      error: () => (this.countFailed = true),
    });
  }

  loadMore(): void {
    if (this.loadingMore() || this.loading() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.loadMoreError.set(false);
    this.loadMoreSub = this.api.getNotifications({ page: this.page() + 1, pageSize: PAGE_SIZE }).subscribe({
      next: res => {
        // Live items prepended since page 1 shift server offsets, so later pages
        // can repeat items already shown — dedupe by id.
        this.items.update(list => {
          const ids = new Set(list.map(n => n.id));
          return [...list, ...res.items.filter(n => !ids.has(n.id))];
        });
        this.page.set(res.page);
        this.totalPages.set(res.totalPages);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loadingMore.set(false);
        this.loadMoreError.set(true);
      },
    });
  }

  /** Optimistic; on failure the item reverts and the count is re-read from the server. */
  markAsRead(id: string): void {
    const item = this.items().find(n => n.id === id);
    if (!item || item.isRead) return;

    this.patchItem(id, { isRead: true, readAt: new Date().toISOString() });
    this.unreadCount.update(c => Math.max(0, c - 1));

    this.api.markAsRead(id).subscribe({
      error: () => {
        this.patchItem(id, { isRead: false, readAt: null });
        this.refreshUnreadCount();
      },
    });
  }

  async markAllAsRead(): Promise<boolean> {
    if (this.markingAll()) return false;
    this.markingAll.set(true);
    try {
      await firstValueFrom(this.api.markAllAsRead());
      const readAt = new Date().toISOString();
      this.items.update(list => list.map(n => (n.isRead ? n : { ...n, isRead: true, readAt })));
      this.unreadCount.set(0);
      return true;
    } catch {
      return false;
    } finally {
      this.markingAll.set(false);
    }
  }

  /** Resolves false only on a real failure; a 404 means it's already gone, so it's dropped locally too. */
  async delete(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.api.delete(id));
    } catch (err) {
      if (!(err instanceof HttpErrorResponse && err.status === 404)) return false;
    }
    this.items.update(list => list.filter(n => n.id !== id));
    this.refreshUnreadCount();
    return true;
  }

  private receive(event: AdminNotificationRealtimeEvent): void {
    const item = fromRealtime(event, this.lang);
    // Same event can reach us via REST and SignalR, or across tabs — id is the only safe key.
    this.items.update(list => (list.some(n => n.id === item.id) ? list : [item, ...list]));
    if (this.listSub) this.liveDuringRefresh.push(item);
    this.unreadCount.set(event.unreadCount);
  }

  private refreshFirstPage(): void {
    this.listSub?.unsubscribe();
    this.loadMoreSub?.unsubscribe();
    this.loadingMore.set(false);
    this.liveDuringRefresh = [];
    this.loading.set(true);
    this.listError.set(false);

    this.listSub = this.api.getNotifications({ page: 1, pageSize: PAGE_SIZE }).subscribe({
      next: res => {
        const ids = new Set(res.items.map(n => n.id));
        const missed = this.liveDuringRefresh.filter(n => !ids.has(n.id));
        this.items.set([...missed, ...res.items]);
        this.page.set(res.page);
        this.totalPages.set(res.totalPages);
        this.forbidden.set(false);
        this.finishRefresh();
      },
      error: (err: HttpErrorResponse) => {
        // Keep whatever is already on screen and surface a retry state instead.
        if (err.status === 403) this.forbidden.set(true);
        else this.listError.set(true);
        this.finishRefresh();
      },
    });
  }

  private finishRefresh(): void {
    this.listSub = null;
    this.liveDuringRefresh = [];
    this.loading.set(false);
    this.initialized.set(true);
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      this.hiddenAt = Date.now();
      return;
    }
    const hiddenFor = this.hiddenAt ? Date.now() - this.hiddenAt : 0;
    this.hiddenAt = null;
    const connection = this.connection;
    if (!connection) return;

    // Automatic reconnect gives up after its last retry; bring the hub back on focus.
    if (connection.state === signalR.HubConnectionState.Disconnected) {
      connection
        .start()
        .catch(() => undefined)
        .finally(() => {
          if (this.connection === connection) this.refresh();
        });
    } else if (hiddenFor > STALE_AFTER_HIDDEN_MS || this.listError()) {
      this.refresh();
    } else if (this.countFailed) {
      this.refreshUnreadCount();
    }
  }

  private patchItem(id: string, patch: Partial<AdminNotification>): void {
    this.items.update(list => list.map(n => (n.id === id ? { ...n, ...patch } : n)));
  }

  private reset(): void {
    this.listSub?.unsubscribe();
    this.loadMoreSub?.unsubscribe();
    this.countSub?.unsubscribe();
    this.listSub = this.loadMoreSub = this.countSub = null;
    this.liveDuringRefresh = [];
    this.countFailed = false;
    this.items.set([]);
    this.unreadCount.set(0);
    this.page.set(0);
    this.totalPages.set(0);
    this.loading.set(false);
    this.loadingMore.set(false);
    this.markingAll.set(false);
    this.listError.set(false);
    this.loadMoreError.set(false);
    this.forbidden.set(false);
    this.initialized.set(false);
  }
}
