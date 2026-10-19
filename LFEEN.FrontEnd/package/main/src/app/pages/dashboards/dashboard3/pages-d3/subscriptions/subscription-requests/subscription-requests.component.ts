import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subscription, catchError, of } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { formatApiDateLocal, parseApiUtc } from 'src/app/utils/date-format.util';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import { SubscriptionCatalogItem, SubscriptionOrder } from '../interfaces/subscription.model';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';
import { RequestDetailDrawerComponent } from './request-detail-drawer/request-detail-drawer.component';
import { orderStatusKind, OrderStatusKind } from './request-status.util';
import { serviceVisual } from '../interfaces/service-visual.util';

type RequestTab = 'all' | 'pending' | 'succeeded' | 'failed';

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

const PAGE_SIZE = 10;
const MAX_SERVICE_ICONS = 3;

/**
 * Read-only order history (GET /requests). Orders activate on payment — there's no admin
 * review — so the list is loaded once and the tabs only filter it.
 */
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

  readonly maxServiceIcons = MAX_SERVICE_ICONS;

  loading = true;
  loadError = false;
  activeTab: RequestTab = 'all';
  currentPage = 1;

  /** Every order, newest first. */
  private rows: RequestRow[] = [];
  private orders: SubscriptionOrder[] = [];
  logoByServiceId = new Map<number, string | null>();
  /** Logo URLs that failed to load — shown as the fallback icon instead of a broken image. */
  readonly brokenLogos = new Set<string>();
  private listRequest?: Subscription;

  selectedOrder: SubscriptionOrder | null = null;

  readonly tabs: { value: RequestTab; labelKey: string }[] = [
    { value: 'all', labelKey: 'd3.subscriptionRequests.tabs.all' },
    { value: 'pending', labelKey: 'd3.subscriptionRequests.tabs.pending' },
    { value: 'succeeded', labelKey: 'd3.subscriptionRequests.tabs.succeeded' },
    { value: 'failed', labelKey: 'd3.subscriptionRequests.tabs.failed' },
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

  /** Orders still waiting on payment. */
  get pendingCount(): number {
    return this.rows.filter(r => r.kind === 'pending').length;
  }

  private get filteredRows(): RequestRow[] {
    return this.activeTab === 'all' ? this.rows : this.rows.filter(r => r.kind === this.activeTab);
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

  load(): void {
    this.listRequest?.unsubscribe();
    this.loading = true;
    this.loadError = false;
    this.listRequest = this.service.getRequests().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: orders => {
        this.orders = orders ?? [];
        this.loading = false;
        this.rebuildRows();
      },
      error: err => {
        this.orders = [];
        this.rows = [];
        this.loading = false;
        this.loadError = true;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  reload(): void {
    this.load();
  }

  setTab(tab: RequestTab): void {
    if (tab === this.activeTab) return;
    this.activeTab = tab;
    this.currentPage = 1;
  }

  private rebuildRows(): void {
    this.rows = this.orders
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
}
