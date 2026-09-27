import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { SubscriptionCatalogItem, SubscriptionOfferCard, SubscriptionPricingItem } from '../interfaces/subscription.model';
import { categoryKeyFromLabel, serviceVisual } from '../interfaces/service-visual.util';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import { LoginService } from '../../../services/login/login.service';
import { ToastrService } from 'ngx-toastr';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';

type StatusFilter = 'all' | 'enabled' | 'disabled';

@Component({
  selector: 'app-subscription-settings',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './subscription-settings.component.html',
  styleUrl: './subscription-settings.component.scss'
})
export class SubscriptionSettingsComponent implements OnInit {
  private subscriptionsService = inject(SubscriptionsService);
  private login = inject(LoginService);
  private toastr = inject(ToastrService);

  constructor(private translate: TranslateService, private router: Router) {}

  isLoading = true;
  searchQuery = '';
  statusFilter: StatusFilter = 'all';

  offers: SubscriptionOfferCard[] = [];
  togglingId: string | null = null;

  /** Keyed by offer.id (the catalog key) — the PUT needs the full original item. */
  private catalogByKey = new Map<string, SubscriptionCatalogItem>();

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
        this.catalogByKey = new Map(catalog.map(item => [item.key, item]));
        this.offers = [...catalog]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map(item => this.mapCatalogItemToOffer(item, pricing));
        this.isLoading = false;
      },
      error: () => {
        this.offers = [];
        this.isLoading = false;
      }
    });
  }

  private mapCatalogItemToOffer(item: SubscriptionCatalogItem, pricing: SubscriptionPricingItem[]): SubscriptionOfferCard {
    const meta = serviceVisual(item.key, item.categoryLabel);
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

  get canManageCatalog(): boolean {
    return this.login.permissions().some(p => p.toLowerCase() === 'subscriptions.managecatalog');
  }

  logoUrl(offer: SubscriptionOfferCard): string | null {
    return this.catalogByKey.get(offer.id)?.logoUrl ?? null;
  }

  // PUT /catalog/{id} is a full replace: every field is resent from the loaded item,
  // otherwise omitted ones (e.g. displayOrder) would be reset server-side.
  toggleActive(offer: SubscriptionOfferCard): void {
    const item = this.catalogByKey.get(offer.id);
    if (!item || !this.canManageCatalog || this.togglingId) return;
    this.togglingId = offer.id;

    this.subscriptionsService.updateCatalogItem(item.id, {
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      category: this.rawCategory(item.categoryLabel),
      logoUrl: item.logoUrl,
      isAvailable: item.isAvailable,
      isActive: !item.isActive,
      displayOrder: item.displayOrder,
    }).subscribe({
      next: updated => {
        this.togglingId = null;
        this.catalogByKey.set(updated.key ?? item.key, { ...item, ...updated });
        offer.active = updated.isActive;
      },
      error: err => {
        this.togglingId = null;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  // The catalog only returns the translated categoryLabel, not the raw category. Known labels
  // (Arabic or English) are sent as their raw key; an unknown one goes back unchanged —
  // never null, which could wipe the category (a mismatch fails loudly with a 400 instead).
  private rawCategory(label: string | null | undefined): string | null {
    if (!label) return null;
    return categoryKeyFromLabel(label) ?? label;
  }

  openServiceSettings(offer: SubscriptionOfferCard): void {
    const lang = this.router.url.split('/')[1] || 'ar';
    this.router.navigate([lang, 'd3', 'subscriptions', 'settings', offer.id]);
  }
}
