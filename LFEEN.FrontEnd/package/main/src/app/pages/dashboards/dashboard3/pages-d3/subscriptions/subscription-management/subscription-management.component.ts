import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { MerchantSubscription, MerchantSubscriptionLine, SubscriberAccount, SubscriptionServiceItem } from '../interfaces/subscription.model';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import { serviceVisual } from '../interfaces/service-visual.util';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';
import { periodText } from '../interfaces/period-text.util';

interface SubscriptionStatCard {
  labelKey: string;
  subtitleKey: string;
  /** null = the overview didn't send this figure, so its card isn't shown. */
  value: number | null;
  icon: string;
  tone: 'purple' | 'blue' | 'green' | 'dark';
  currency: boolean;
}

const PAGE_SIZE = 10;
/** Service chips carry the name, so fewer fit than bare icons did. */
const MAX_SERVICE_ICONS = 2;

@Component({
  selector: 'app-subscription-management',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './subscription-management.component.html',
  styleUrl: './subscription-management.component.scss'
})
export class SubscriptionManagementComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private subscriptionsService = inject(SubscriptionsService);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);

  readonly maxServiceIcons = MAX_SERVICE_ICONS;

  isLoading = true;
  listLoading = true;
  searchQuery = '';
  expandedId: string | null = null;

  currentPage = 1;
  totalPages = 1;
  totalCount = 0;

  accounts: SubscriberAccount[] = [];
  misconfiguredServicesCount = 0;
  private pageRequest?: Subscription;

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get currencyIconAlt(): string {
    return this.currentLang === 'en' ? 'SAR' : 'ريال سعودي';
  }

  get currencyIconEn(): boolean {
    return this.currentLang === 'en';
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  /** Rates can be fractions (0.5 SAR, 2.5%), which fmt() would round away. */
  fmtPrecise(value: number): string {
    return value.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA', { maximumFractionDigits: 4 });
  }

  /** Lines without a start or expiry (message balance, free) leave the date columns out. */
  hasDates(account: SubscriberAccount): boolean {
    return account.services.some(s => s.startDate !== '-' || s.endDate !== '-');
  }

  stats: SubscriptionStatCard[] = [
    { labelKey: '', subtitleKey: 'd3.subscriptions.stats.total', value: null, icon: 'users', tone: 'dark', currency: false },
    { labelKey: 'd3.subscriptions.stats.active', subtitleKey: 'd3.subscriptions.stats.activeDesc', value: null, icon: 'user-check', tone: 'green', currency: false },
    { labelKey: 'd3.subscriptions.stats.monthly', subtitleKey: 'd3.subscriptions.stats.monthlyDesc', value: null, icon: 'trending-up', tone: 'blue', currency: true },
    { labelKey: 'd3.subscriptions.stats.annual', subtitleKey: 'd3.subscriptions.stats.annualDesc', value: null, icon: 'calendar', tone: 'purple', currency: true },
    { labelKey: 'd3.subscriptions.stats.free', subtitleKey: 'd3.subscriptions.stats.freeDesc', value: null, icon: 'gift', tone: 'green', currency: false },
  ];

  get visibleStats(): SubscriptionStatCard[] {
    return this.stats.filter(s => s.value !== null);
  }

  ngOnInit(): void {
    this.subscriptionsService.getOverview().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (overview) => {
        // No distinct "total subscribers" figure (nor a growth %) exists in the API — the closest
        // available number is the count of merchants with an active subscription.
        // Any figure the response leaves out stays null and its card is hidden — an undefined
        // value would otherwise throw in fmt() and stop the rest of the page from rendering.
        const num = (v: unknown) => (typeof v === 'number' ? v : null);
        this.stats[0].value = num(overview.totalMerchantsWithActiveSubscription);
        this.stats[1].value = num(overview.activeSubscriptionsCount);
        this.stats[2].value = num(overview.monthlyRevenue);
        this.stats[3].value = num(overview.annualRevenue);
        // No "automatic activation" card: every subscription activates on payment now.
        this.stats[4].value = num(overview.freeSubscriptionsCount);
        this.misconfiguredServicesCount = num(overview.misconfiguredServicesCount) ?? 0;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
    this.loadPage();
  }

  // Paginated by merchant row — a merchant's services array is never itself paginated.
  private loadPage(): void {
    this.pageRequest?.unsubscribe();
    this.listLoading = true;
    this.pageRequest = this.subscriptionsService.getMerchantSubscriptions({ pageNumber: this.currentPage, pageSize: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: page => {
          this.accounts = page.data.map(m => this.toAccount(m));
          this.totalCount = page.totalCount;
          this.totalPages = page.totalPages;
          this.expandedId = null;
          this.listLoading = false;
        },
        error: err => {
          this.accounts = [];
          this.totalCount = 0;
          this.totalPages = 1;
          this.listLoading = false;
          this.toastr.error(resolveSubscriptionError(err, this.translate));
        },
      });
  }

  private toAccount(m: MerchantSubscription): SubscriberAccount {
    return {
      id: m.accountId,
      facilityName: m.merchantName?.trim() || '-',
      // "Active" if any service is active, "Expired" once all of them have lapsed.
      status: (m.overallStatus ?? '').toLowerCase() === 'active' ? 'active' : 'expired',
      // Already localized by the API; the badge falls back to our own label without it.
      statusLabel: m.overallStatusLabel?.trim() || '',
      // Only currently-active lines, as a monthly figure. The annual total is just this ×12 —
      // there's no annual price any more — so it isn't shown.
      feesAmountValue: m.monthlyEquivalentTotal ?? 0,
      services: (m.services ?? []).map(s => this.toServiceItem(s)),
    };
  }

  private toServiceItem(s: MerchantSubscriptionLine): SubscriptionServiceItem {
    // A Transaction line's charge is its usage rate; `price` is only meaningful otherwise.
    const rate = s.usageUnitType && s.usageUnitType !== 'None' && typeof s.usageUnitPrice === 'number' ? s.usageUnitPrice : null;
    const percent = rate !== null && s.usageUnitType === 'PercentageOfValue';
    const periodName = periodText(s.periodLabel, s.period);
    return {
      name: s.serviceName?.trim() || '-',
      categoryLabel: s.categoryLabel?.trim() || '-',
      icon: serviceVisual(s.serviceKey, s.categoryLabel).icon,
      priceKind: rate === null ? 'amount' : percent ? 'percent' : 'perUnit',
      priceValue: rate === null ? (typeof s.price === 'number' ? s.price : null) : percent ? rate * 100 : rate,
      periodName,
      periodLabel: [s.tierName?.trim(), periodName].filter(Boolean).join(' · ') || '-',
      startDate: formatApiDateLocal(s.startDate, this.currentLang) ?? '-',
      endDate: formatApiDateLocal(s.expiresAt, this.currentLang) ?? '-',
      // NotSubscribed | Active | Expired — anything not active is shown as lapsed.
      expired: (s.status ?? '').toLowerCase() !== 'active',
      billingModel: s.billingModel ?? 'Paid',
      statusLabel: s.statusLabel?.trim() || '',
    };
  }

  // The endpoint has no search parameter, so the box filters the merchants on the current page.
  get filteredAccounts(): SubscriberAccount[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.accounts;
    return this.accounts.filter(a => a.facilityName.toLowerCase().includes(q));
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  toggleExpand(account: SubscriberAccount): void {
    this.expandedId = this.expandedId === account.id ? null : account.id;
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadPage();
  }

  extraServicesCount(account: SubscriberAccount): number {
    return Math.max(0, account.services.length - MAX_SERVICE_ICONS);
  }

  /**
   * With one active line the row shows that line's own price — the same as the details —
   * instead of the monthly equivalent, which can differ (or be 0) and would contradict them.
   */
  singleActiveService(account: SubscriberAccount): SubscriptionServiceItem | null {
    const active = account.services.filter(s => !s.expired);
    return active.length === 1 ? active[0] : null;
  }

  activeServiceCount(account: SubscriberAccount): number {
    return account.services.filter(s => !s.expired).length;
  }
}
