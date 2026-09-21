import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { SubscriptionCatalogItem, SubscriptionOfferCard, SubscriptionOfferTone, SubscriptionPricingItem } from '../interfaces/subscription.model';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { SubscriptionsService } from '../../../services/subscriptions.service';

type StatusFilter = 'all' | 'enabled' | 'disabled';

// The catalog's categoryLabel is the only data-driven signal available for icon/tone —
// there's no per-service branding field in the API.
const CATEGORY_META: Record<string, { icon: string; tone: SubscriptionOfferTone }> = {
  Compliance: { icon: 'receipt', tone: 'purple' },
  SmartLock: { icon: 'lock', tone: 'orange' },
  GovernmentPlatform: { icon: 'building-bank', tone: 'blue' },
  Maps: { icon: 'map-pin', tone: 'blue' },
  ChannelManager: { icon: 'link', tone: 'orange' },
  Messaging: { icon: 'brand-whatsapp', tone: 'green' },
  Erp: { icon: 'building-warehouse', tone: 'purple' },
  Payments: { icon: 'credit-card', tone: 'blue' },
  Other: { icon: 'apps', tone: 'orange' },
};
const DEFAULT_CATEGORY_META = CATEGORY_META['Other'];

@Component({
  selector: 'app-subscription-settings',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './subscription-settings.component.html',
  styleUrl: './subscription-settings.component.scss'
})
export class SubscriptionSettingsComponent implements OnInit {
  private subscriptionsService = inject(SubscriptionsService);

  constructor(private translate: TranslateService, private router: Router) {}

  isLoading = true;
  searchQuery = '';
  statusFilter: StatusFilter = 'all';

  offers: SubscriptionOfferCard[] = [];

  statusFilterOptions: { value: StatusFilter; labelKey: string }[] = [
    { value: 'all', labelKey: 'd3.subscriptions.settings.filters.all' },
    { value: 'enabled', labelKey: 'd3.subscriptions.settings.status.enabled' },
    { value: 'disabled', labelKey: 'd3.subscriptions.settings.status.disabled' },
  ];

  get selectedFilterLabelKey(): string {
    return this.statusFilterOptions.find(o => o.value === this.statusFilter)?.labelKey ?? 'd3.subscriptions.settings.filters.all';
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

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

  offerName(offer: SubscriptionOfferCard): string {
    return this.translate.currentLang === 'en' ? offer.nameEn : offer.nameAr;
  }

  ngOnInit(): void {
    forkJoin({
      catalog: this.subscriptionsService.getCatalog(),
      pricing: this.subscriptionsService.getPricing(),
    }).subscribe({
      next: ({ catalog, pricing }) => {
        this.offers = catalog.map(item => this.mapCatalogItemToOffer(item, pricing));
        this.isLoading = false;
      },
      error: () => {
        this.offers = [];
        this.isLoading = false;
      }
    });
  }

  private mapCatalogItemToOffer(item: SubscriptionCatalogItem, pricing: SubscriptionPricingItem[]): SubscriptionOfferCard {
    const meta = CATEGORY_META[item.categoryLabel] ?? DEFAULT_CATEGORY_META;
    const monthlyPrice = this.findActivePrice(pricing, item.id, 'Monthly');
    const annualPrice = this.findActivePrice(pricing, item.id, 'Yearly');

    return {
      id: item.key,
      icon: meta.icon,
      tone: meta.tone,
      active: item.isActive,
      badgeIcon: 'shield-check',
      badgeTone: 'purple',
      badgeText: '-',
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      desc: '-',
      feature1: '-',
      feature2: '-',
      isFree: monthlyPrice === 0,
      monthlyPriceValue: monthlyPrice,
      annualPriceValue: annualPrice,
    };
  }

  private findActivePrice(pricing: SubscriptionPricingItem[], subscriptionServiceId: number, period: 'Monthly' | 'Yearly'): number | null {
    const row = pricing.find(p => p.subscriptionServiceId === subscriptionServiceId && p.period === period && p.isActive);
    return row ? row.price : null;
  }

  get filteredOffers(): SubscriptionOfferCard[] {
    let list = this.offers;
    if (this.statusFilter === 'enabled') list = list.filter(o => o.active);
    if (this.statusFilter === 'disabled') list = list.filter(o => !o.active);
    const q = this.searchQuery.trim();
    if (q) {
      list = list.filter(o => o.nameAr.includes(q) || o.nameEn.includes(q));
    }
    return list;
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
  }

  onFilterChange(value: StatusFilter): void {
    this.statusFilter = value;
  }

  openServiceSettings(offer: SubscriptionOfferCard): void {
    const lang = this.router.url.split('/')[1] || 'ar';
    this.router.navigate([lang, 'd3', 'subscriptions', 'settings', offer.id]);
  }
}
