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

interface SubscriptionStatCard {
  labelKey: string;
  subtitleKey: string;
  value: number;
  icon: string;
  tone: 'purple' | 'blue' | 'green' | 'dark';
  currency: boolean;
}

const PAGE_SIZE = 10;
const MAX_SERVICE_ICONS = 3;

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

  stats: SubscriptionStatCard[] = [
    { labelKey: '', subtitleKey: 'd3.subscriptions.stats.total', value: 0, icon: 'users', tone: 'dark', currency: false },
    { labelKey: 'd3.subscriptions.stats.active', subtitleKey: 'd3.subscriptions.stats.activeDesc', value: 0, icon: 'user-check', tone: 'green', currency: false },
    { labelKey: 'd3.subscriptions.stats.monthly', subtitleKey: 'd3.subscriptions.stats.monthlyDesc', value: 0, icon: 'trending-up', tone: 'blue', currency: true },
    { labelKey: 'd3.subscriptions.stats.annual', subtitleKey: 'd3.subscriptions.stats.annualDesc', value: 0, icon: 'calendar', tone: 'purple', currency: true },
  ];

  ngOnInit(): void {
    this.subscriptionsService.getOverview().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (overview) => {
        // No distinct "total subscribers" figure (nor a growth %) exists in the API — the closest
        // available number is the count of merchants with an active subscription.
        this.stats[0].value = overview.totalMerchantsWithActiveSubscription;
        this.stats[1].value = overview.activeSubscriptionsCount;
        this.stats[2].value = overview.monthlyRevenue;
        this.stats[3].value = overview.annualRevenue;
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
      // Both totals only count currently-active lines, normalized across billing periods.
      feesAmountValue: m.monthlyEquivalentTotal ?? 0,
      feesAnnualValue: m.annualEquivalentTotal ?? 0,
      services: (m.services ?? []).map(s => this.toServiceItem(s)),
    };
  }

  private toServiceItem(s: MerchantSubscriptionLine): SubscriptionServiceItem {
    return {
      name: s.serviceName?.trim() || '-',
      categoryLabel: s.categoryLabel?.trim() || '-',
      icon: serviceVisual(s.serviceKey, s.categoryLabel).icon,
      priceValue: typeof s.price === 'number' ? s.price : null,
      periodLabel: [s.tierName?.trim(), s.periodLabel?.trim() || s.period].filter(Boolean).join(' · ') || '-',
      startDate: formatApiDateLocal(s.startDate, this.currentLang) ?? '-',
      endDate: formatApiDateLocal(s.expiresAt, this.currentLang) ?? '-',
      expired: (s.status ?? '').toLowerCase() === 'expired',
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
}
