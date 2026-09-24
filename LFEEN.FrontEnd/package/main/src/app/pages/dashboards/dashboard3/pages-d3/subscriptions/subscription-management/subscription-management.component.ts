import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { SubscriberAccount } from '../interfaces/subscription.model';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { SubscriptionsService } from '../../../services/subscriptions.service';

interface SubscriptionStatCard {
  labelKey: string;
  isGrowth: boolean;
  subtitleKey: string;
  value: number;
  icon: string;
  tone: 'purple' | 'blue' | 'green' | 'dark';
  currency: boolean;
}

@Component({
  selector: 'app-subscription-management',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './subscription-management.component.html',
  styleUrl: './subscription-management.component.scss'
})
export class SubscriptionManagementComponent implements OnInit {
  private subscriptionsService = inject(SubscriptionsService);

  constructor(private translate: TranslateService) {}

  isLoading = true;
  searchQuery = '';
  expandedId: number | null = null;

  currentPage = 1;
  totalPages = 1;
  totalCount = 0;
  growthPercent = 0;

  get currencyIconSrc(): string {
    return this.translate.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get currencyIconAlt(): string {
    return this.translate.currentLang === 'en' ? 'SAR' : 'ريال سعودي';
  }

  get currencyIconEn(): boolean {
    return this.translate.currentLang === 'en';
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.translate.currentLang);
  }

  formatDate(date: Date): string {
    return date.toLocaleDateString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  stats: SubscriptionStatCard[] = [
    { labelKey: '', isGrowth: false, subtitleKey: 'd3.subscriptions.stats.total', value: 0, icon: 'users', tone: 'dark', currency: false },
    { labelKey: 'd3.subscriptions.stats.active', isGrowth: false, subtitleKey: 'd3.subscriptions.stats.activeDesc', value: 0, icon: 'user-check', tone: 'green', currency: false },
    { labelKey: 'd3.subscriptions.stats.monthly', isGrowth: false, subtitleKey: 'd3.subscriptions.stats.monthlyDesc', value: 0, icon: 'trending-up', tone: 'blue', currency: true },
    { labelKey: 'd3.subscriptions.stats.annual', isGrowth: false, subtitleKey: 'd3.subscriptions.stats.annualDesc', value: 0, icon: 'calendar', tone: 'purple', currency: true },
  ];

  // No backend endpoint currently returns the subscriber-accounts list with their per-service
  // pricing (only the order queue and the raw catalog/pricing tables exist) — left empty so the
  // template's existing app-dashboard-empty state renders instead of fake data.
  accounts: SubscriberAccount[] = [];

  ngOnInit(): void {
    this.subscriptionsService.getOverview().subscribe({
      next: (overview) => {
        // No distinct "total subscriptions" figure exists in the API — the closest available
        // number is the count of merchants with an active subscription.
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
  }

  get filteredAccounts(): SubscriberAccount[] {
    const q = this.searchQuery.trim();
    if (!q) return this.accounts;
    return this.accounts.filter(a => a.facilityName.includes(q));
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
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
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  extraServicesCount(account: SubscriberAccount): number {
    return Math.max(0, account.servicesCount - Math.min(3, account.services.length));
  }
}
