import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { SubscriberAccount } from '../interfaces/subscription.model';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';

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
  constructor(private translate: TranslateService) {}

  isLoading = true;
  searchQuery = '';
  expandedId: number | null = 3;

  currentPage = 1;
  totalPages = 4;
  totalCount = 47;
  growthPercent = 11;

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
    { labelKey: '', isGrowth: true, subtitleKey: 'd3.subscriptions.stats.total', value: 1348, icon: 'users', tone: 'dark', currency: false },
    { labelKey: 'd3.subscriptions.stats.active', isGrowth: false, subtitleKey: 'd3.subscriptions.stats.activeDesc', value: 1192, icon: 'user-check', tone: 'green', currency: false },
    { labelKey: 'd3.subscriptions.stats.monthly', isGrowth: false, subtitleKey: 'd3.subscriptions.stats.monthlyDesc', value: 42500, icon: 'trending-up', tone: 'blue', currency: true },
    { labelKey: 'd3.subscriptions.stats.annual', isGrowth: false, subtitleKey: 'd3.subscriptions.stats.annualDesc', value: 50000, icon: 'calendar', tone: 'purple', currency: true },
  ];

  accounts: SubscriberAccount[] = [
    {
      id: 1,
      facilityName: 'فندق الريتز كارلتون',
      classificationKey: 'd3.subscriptions.classification.hotel',
      icon: 'building-skyscraper',
      status: 'active',
      feesAmountValue: 1450,
      feesPeriod: 'monthly',
      feesAnnualValue: 17400,
      servicesCount: 4,
      services: [
        { id: 11, name: 'واتساب للأعمال', categoryKey: 'd3.subscriptions.category.communication', icon: 'brand-whatsapp', priceValue: 89, period: 'annual', startDate: new Date(2024, 5, 1), endDate: new Date(2025, 5, 1) },
        { id: 12, name: 'منصة رصد', categoryKey: 'd3.subscriptions.category.analytics', icon: 'chart-line', priceValue: 1300, period: 'annual', startDate: new Date(2024, 6, 15), endDate: new Date(2025, 6, 15) },
        { id: 13, name: 'بوابة السياحة', categoryKey: 'd3.subscriptions.category.bookings', icon: 'map-pin', priceValue: null, period: 'annual', startDate: new Date(2024, 4, 14), endDate: new Date(2025, 4, 14) },
      ]
    },
    {
      id: 2,
      facilityName: 'منتجع اللؤلؤة الزرقاء',
      classificationKey: 'd3.subscriptions.classification.resort',
      icon: 'building-skyscraper',
      status: 'active',
      feesAmountValue: 2100,
      feesPeriod: 'monthly',
      feesAnnualValue: 25200,
      servicesCount: 3,
      services: [
        { id: 21, name: 'واتساب للأعمال', categoryKey: 'd3.subscriptions.category.communication', icon: 'brand-whatsapp', priceValue: 89, period: 'annual', startDate: new Date(2024, 2, 5), endDate: new Date(2025, 2, 5) },
        { id: 22, name: 'منصة رصد', categoryKey: 'd3.subscriptions.category.analytics', icon: 'chart-line', priceValue: 1300, period: 'annual', startDate: new Date(2024, 2, 10), endDate: new Date(2025, 2, 10) },
      ]
    },
    {
      id: 3,
      facilityName: 'شقق لاند مارك الفاخرة',
      classificationKey: 'd3.subscriptions.classification.apartments',
      icon: 'building',
      status: 'active',
      feesAmountValue: 890,
      feesPeriod: 'monthly',
      feesAnnualValue: 10680,
      servicesCount: 3,
      services: [
        { id: 31, name: 'واتساب للأعمال', categoryKey: 'd3.subscriptions.category.communication', icon: 'brand-whatsapp', priceValue: 89, period: 'annual', startDate: new Date(2024, 5, 1), endDate: new Date(2025, 5, 1) },
        { id: 32, name: 'منصة رصد', categoryKey: 'd3.subscriptions.category.analytics', icon: 'chart-line', priceValue: 1300, period: 'annual', startDate: new Date(2024, 6, 15), endDate: new Date(2025, 6, 15) },
        { id: 33, name: 'بوابة السياحة', categoryKey: 'd3.subscriptions.category.bookings', icon: 'map-pin', priceValue: null, period: 'annual', startDate: new Date(2024, 4, 14), endDate: new Date(2025, 4, 14) },
      ]
    },
    {
      id: 4,
      facilityName: 'فيلات الواحة الذهبية',
      classificationKey: 'd3.subscriptions.classification.villas',
      icon: 'home',
      status: 'suspended',
      feesAmountValue: 650,
      feesPeriod: 'monthly',
      feesAnnualValue: 7800,
      servicesCount: 2,
      services: [
        { id: 41, name: 'واتساب للأعمال', categoryKey: 'd3.subscriptions.category.communication', icon: 'brand-whatsapp', priceValue: 89, period: 'annual', startDate: new Date(2024, 1, 1), endDate: new Date(2025, 1, 1) },
      ]
    },
  ];

  ngOnInit(): void {
    // simulates the initial fetch so the loading skeleton has something to show
    setTimeout(() => { this.isLoading = false; }, 500);
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
