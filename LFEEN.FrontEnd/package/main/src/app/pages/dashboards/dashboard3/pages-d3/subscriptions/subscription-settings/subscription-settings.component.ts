import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { SubscriptionCatalogItem, SubscriptionOfferCard } from '../interfaces/subscription.model';
import { serviceVisual } from '../interfaces/service-visual.util';
import { buildCatalogUpdate } from '../interfaces/catalog-update.util';
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

  offerDesc(offer: SubscriptionOfferCard): string {
    return (this.translate.currentLang === 'en' ? offer.descEn : offer.descAr) || '';
  }

  featureText(feature: { textAr: string; textEn: string }): string {
    return this.translate.currentLang === 'en' ? feature.textEn : feature.textAr;
  }

  // GET /catalog already carries the whole card: description, feature bullets, the default
  // tier's current prices (seasonal override included) and its trial length.
  ngOnInit(): void {
    this.subscriptionsService.getCatalog().subscribe({
      next: catalog => {
        this.catalogByKey = new Map(catalog.map(item => [item.key, item]));
        this.offers = [...catalog]
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map(item => this.mapCatalogItemToOffer(item));
        this.isLoading = false;
      },
      error: err => {
        this.offers = [];
        this.isLoading = false;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      }
    });
  }

  private mapCatalogItemToOffer(item: SubscriptionCatalogItem): SubscriptionOfferCard {
    const meta = serviceVisual(item.key, item.categoryLabel);

    return {
      id: item.key,
      icon: meta.icon,
      tone: meta.tone,
      active: item.isActive,
      trialDays: item.trialDays ?? 0,
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      descAr: item.descriptionAr ?? '',
      descEn: item.descriptionEn ?? '',
      features: (item.features ?? []).filter(f => f.isActive !== false),
      monthlyPriceValue: item.monthlyPrice ?? null,
      annualPriceValue: item.yearlyPrice ?? null,
    };
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

  toggleActive(offer: SubscriptionOfferCard): void {
    const item = this.catalogByKey.get(offer.id);
    if (!item || !this.canManageCatalog || this.togglingId) return;
    this.togglingId = offer.id;

    this.subscriptionsService.updateCatalogItem(item.id, buildCatalogUpdate(item, { isActive: !item.isActive })).subscribe({
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

  openServiceSettings(offer: SubscriptionOfferCard): void {
    const lang = this.router.url.split('/')[1] || 'ar';
    this.router.navigate([lang, 'd3', 'subscriptions', 'settings', offer.id]);
  }
}
