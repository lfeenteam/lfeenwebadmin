import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { SubscriptionOfferCard } from '../interfaces/subscription.model';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';

type StatusFilter = 'all' | 'enabled' | 'disabled';

@Component({
  selector: 'app-subscription-settings',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './subscription-settings.component.html',
  styleUrl: './subscription-settings.component.scss'
})
export class SubscriptionSettingsComponent implements OnInit {
  constructor(private translate: TranslateService, private router: Router) {}

  isLoading = true;
  searchQuery = '';
  statusFilter: StatusFilter = 'all';

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

  offers: SubscriptionOfferCard[] = [
    { id: 'whatsappMuqam', icon: 'brand-whatsapp', tone: 'green', active: false, badgeIcon: 'gift', badgeTone: 'purple', isFree: true, monthlyPriceValue: 0, annualPriceValue: 0 },
    { id: 'rasd', icon: 'map-pin', tone: 'blue', active: true, badgeIcon: 'clock', badgeTone: 'green', isFree: false, monthlyPriceValue: 1450, annualPriceValue: 14000 },
    { id: 'whatsappBusiness', icon: 'brand-whatsapp', tone: 'green', active: true, badgeIcon: 'gift', badgeTone: 'amber', isFree: false, monthlyPriceValue: 150, annualPriceValue: 1450 },
    { id: 'zatca', icon: 'receipt', tone: 'purple', active: true, badgeIcon: 'clock', badgeTone: 'green', isFree: false, monthlyPriceValue: 200, annualPriceValue: 2000 },
    { id: 'payments', icon: 'credit-card', tone: 'blue', active: true, badgeIcon: 'shield-check', badgeTone: 'green', isFree: false, monthlyPriceValue: 180, annualPriceValue: 1800 },
    { id: 'sms', icon: 'message-2', tone: 'orange', active: true, badgeIcon: 'gift', badgeTone: 'amber', isFree: false, monthlyPriceValue: 120, annualPriceValue: 1200 },
  ];

  ngOnInit(): void {
    // simulates the initial fetch so the loading skeleton has something to show
    setTimeout(() => { this.isLoading = false; }, 500);
  }

  get filteredOffers(): SubscriptionOfferCard[] {
    let list = this.offers;
    if (this.statusFilter === 'enabled') list = list.filter(o => o.active);
    if (this.statusFilter === 'disabled') list = list.filter(o => !o.active);
    const q = this.searchQuery.trim();
    if (q) {
      list = list.filter(o => this.translate.instant(`d3.subscriptions.settings.services.${o.id}.name`).includes(q));
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
