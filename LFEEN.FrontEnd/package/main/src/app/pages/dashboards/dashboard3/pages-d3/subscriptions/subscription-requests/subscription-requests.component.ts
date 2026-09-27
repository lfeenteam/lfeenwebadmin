import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subscription, catchError, forkJoin, map, of } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { formatApiDateLocal, parseApiUtc } from 'src/app/utils/date-format.util';
import { LoginService } from '../../../services/login/login.service';
import { ORDER_STATUSES, SubscriptionsService } from '../../../services/subscriptions.service';
import { SubscriptionCatalogItem, SubscriptionOrder, SubscriptionOrderStatus } from '../interfaces/subscription.model';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';
import { RequestDetailDrawerComponent, RequestDrawerResult } from './request-detail-drawer/request-detail-drawer.component';
import { orderStatusKind, OrderStatusKind } from './request-status.util';
import { serviceVisual } from '../interfaces/service-visual.util';

type RequestTab = 'all' | 'rejected' | 'approved' | 'underReview';

interface RequestService {
  name: string;
  logoUrl: string | null;
  icon: string;
}

interface RequestRow {
  order: SubscriptionOrder;
  merchantName: string;
  services: RequestService[];
  requestedAt: Date | null;
  kind: OrderStatusKind;
}

const TAB_STATUSES: Record<RequestTab, SubscriptionOrderStatus[]> = {
  underReview: ['UnderReview'],
  approved: ['Approved'],
  rejected: ['Rejected'],
  all: ORDER_STATUSES,
};

const PAGE_SIZE = 10;
const MAX_SERVICE_ICONS = 3;

@Component({
  selector: 'app-subscription-requests',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent, RequestDetailDrawerComponent],
  templateUrl: './subscription-requests.component.html',
  styleUrl: './subscription-requests.component.scss'
})
export class SubscriptionRequestsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private service = inject(SubscriptionsService);
  private login = inject(LoginService);

  readonly maxServiceIcons = MAX_SERVICE_ICONS;

  loading = true;
  loadError = false;
  activeTab: RequestTab = 'underReview';
  currentPage = 1;

  private rows: RequestRow[] = [];
  logoByServiceId = new Map<number, string | null>();
  /** Logo URLs that failed to load — shown as the fallback icon instead of a broken image. */
  readonly brokenLogos = new Set<string>();
  /** Orders per status filter, fetched only when a tab needs them. */
  private cache = new Map<SubscriptionOrderStatus, SubscriptionOrder[]>();
  private listRequest?: Subscription;

  selectedOrder: SubscriptionOrder | null = null;

  readonly tabs: { value: RequestTab; labelKey: string }[] = [
    { value: 'all', labelKey: 'd3.subscriptionRequests.tabs.all' },
    { value: 'rejected', labelKey: 'd3.subscriptionRequests.tabs.rejected' },
    { value: 'approved', labelKey: 'd3.subscriptionRequests.tabs.approved' },
    { value: 'underReview', labelKey: 'd3.subscriptionRequests.tabs.underReview' },
  ];

  ngOnInit(): void {
    // The catalog only supplies service logos — the list still works without it.
    this.service.getCatalog()
      .pipe(catchError(() => of([] as SubscriptionCatalogItem[])), takeUntilDestroyed(this.destroyRef))
      .subscribe(catalog => {
        this.logoByServiceId = new Map(catalog.map(c => [c.id, c.logoUrl]));
        this.rebuildRows();
      });
    this.load();
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get currencyIconEn(): boolean {
    return this.currentLang === 'en';
  }

  get canApprove(): boolean {
    return this.hasPermission('subscriptions.approve');
  }

  get canReject(): boolean {
    return this.hasPermission('subscriptions.reject');
  }

  /** Known once UnderReview has been fetched (it's the default tab, so normally right away). */
  get underReviewCount(): number {
    return this.cache.get('UnderReview')?.length ?? 0;
  }

  private get filteredRows(): RequestRow[] {
    return this.rows;
  }

  get pagedRows(): RequestRow[] {
    const start = (this.currentPage - 1) * PAGE_SIZE;
    return this.filteredRows.slice(start, start + PAGE_SIZE);
  }

  get totalCount(): number {
    return this.filteredRows.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / PAGE_SIZE));
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  fmtAmount(value: number): string {
    return value.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA', { maximumFractionDigits: 2 });
  }

  formatDate(row: RequestRow): string {
    return formatApiDateLocal(row.order.requestedAt, this.currentLang) ?? '-';
  }

  /** Fetches only the statuses the active tab shows that aren't cached yet. */
  load(): void {
    this.listRequest?.unsubscribe();
    const statuses = TAB_STATUSES[this.activeTab];
    const missing = statuses.filter(s => !this.cache.has(s));
    this.loadError = false;

    if (!missing.length) {
      this.loading = false;
      this.rebuildRows();
      return;
    }

    this.loading = true;
    // On "All", an unconfirmed status that EQAMATIK rejects is skipped rather than failing the tab.
    const tolerant = this.activeTab === 'all';
    this.listRequest = forkJoin(missing.map(status => {
      const request$ = this.service.getRequestsByStatus(status).pipe(map(orders => ({ status, orders })));
      return tolerant && status !== 'UnderReview'
        ? request$.pipe(catchError(() => of({ status, orders: [] as SubscriptionOrder[] })))
        : request$;
    })).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: results => {
        for (const { status, orders } of results) this.cache.set(status, orders);
        this.loading = false;
        this.rebuildRows();
      },
      error: err => {
        this.rows = [];
        this.loading = false;
        this.loadError = true;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  /** Drops the cache and refetches the active tab (retry button / stale-state recovery). */
  reload(): void {
    this.cache.clear();
    this.load();
  }

  setTab(tab: RequestTab): void {
    if (tab === this.activeTab) return;
    this.activeTab = tab;
    this.currentPage = 1;
    this.load();
  }

  private rebuildRows(): void {
    const seen = new Set<string>();
    this.rows = TAB_STATUSES[this.activeTab]
      .flatMap(s => this.cache.get(s) ?? [])
      .filter(o => !seen.has(o.orderId) && !!seen.add(o.orderId))
      .map(o => this.toRow(o))
      .sort((a, b) => (b.requestedAt?.getTime() ?? 0) - (a.requestedAt?.getTime() ?? 0));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  openDetail(row: RequestRow): void {
    this.selectedOrder = row.order;
  }

  onDrawerClosed(result: RequestDrawerResult): void {
    this.selectedOrder = null;
    if (!result) return;
    if (result.type === 'refresh') {
      this.reload();
      return;
    }
    // Move the order out of whatever status bucket it was in. The target bucket is only
    // updated if it was already fetched — otherwise it'll load fresh when its tab opens.
    const updated = result.order;
    for (const [status, orders] of this.cache) {
      this.cache.set(status, orders.filter(o => o.orderId !== updated.orderId));
    }
    const target = updated.status as SubscriptionOrderStatus;
    this.cache.get(target)?.unshift(updated);
    this.rebuildRows();
  }

  private toRow(order: SubscriptionOrder): RequestRow {
    const seen = new Set<number>();
    const services: RequestService[] = [];
    for (const item of order.items ?? []) {
      if (seen.has(item.subscriptionServiceId)) continue;
      seen.add(item.subscriptionServiceId);
      services.push({
        name: item.serviceName,
        logoUrl: this.logoByServiceId.get(item.subscriptionServiceId) ?? null,
        icon: serviceVisual(item.serviceKey).icon,
      });
    }
    return {
      order,
      merchantName: order.merchantName?.trim() || '-',
      services,
      requestedAt: parseApiUtc(order.requestedAt),
      kind: orderStatusKind(order.status),
    };
  }

  private hasPermission(permission: string): boolean {
    return this.login.permissions().some(p => p.toLowerCase() === permission);
  }
}
