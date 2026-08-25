import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { SubscriptionLogActionType, SubscriptionLogEntry } from '../interfaces/subscription.model';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';

@Component({
  selector: 'app-subscription-log',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './subscription-log.component.html',
  styleUrl: './subscription-log.component.scss'
})
export class SubscriptionLogComponent implements OnInit {
  constructor(private translate: TranslateService) {}

  isLoading = true;
  searchQuery = '';
  actionFilter: SubscriptionLogActionType | 'all' = 'all';

  currentPage = 1;
  totalPages = 3;
  totalCount = 28;

  actionFilterOptions: { value: SubscriptionLogActionType | 'all'; labelKey: string }[] = [
    { value: 'all', labelKey: 'd3.subscriptionLog.filters.all' },
    { value: 'renew', labelKey: 'd3.subscriptionLog.action.renew' },
    { value: 'add', labelKey: 'd3.subscriptionLog.action.add' },
    { value: 'cancel', labelKey: 'd3.subscriptionLog.action.cancel' },
  ];

  get selectedFilterLabelKey(): string {
    return this.actionFilterOptions.find(o => o.value === this.actionFilter)?.labelKey ?? 'd3.subscriptionLog.filters.all';
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

  entries: SubscriptionLogEntry[] = [
    { id: 1, refNumber: '#REF-9021', actionType: 'renew', serviceName: 'واتساب للأعمال', serviceIcon: 'brand-whatsapp', actorName: 'أحمد الزهراني', actorInitial: 'أ', date: new Date(2024, 9, 14), status: 'completed' },
    { id: 2, refNumber: '#REF-8942', actionType: 'add', serviceName: 'منصة رصد', serviceIcon: 'chart-line', actorName: 'سارة العتيبي', actorInitial: 'س', date: new Date(2024, 9, 13), status: 'completed' },
    { id: 3, refNumber: '#REF-8810', actionType: 'renew', serviceName: 'بوابة السياحة', serviceIcon: 'map-pin', actorName: 'خالد محمد', actorInitial: 'خ', date: new Date(2024, 9, 12), status: 'processing' },
    { id: 4, refNumber: '#REF-8755', actionType: 'cancel', serviceName: 'خدمة التنبيهات', serviceIcon: 'bell', actorName: 'نورة علي', actorInitial: 'ن', date: new Date(2024, 9, 11), status: 'cancelled' },
  ];

  ngOnInit(): void {
    // simulates the initial fetch so the loading skeleton has something to show
    setTimeout(() => { this.isLoading = false; }, 500);
  }

  get filteredEntries(): SubscriptionLogEntry[] {
    let list = this.entries;
    if (this.actionFilter !== 'all') {
      list = list.filter(e => e.actionType === this.actionFilter);
    }
    const q = this.searchQuery.trim();
    if (q) {
      list = list.filter(e => e.serviceName.includes(q) || e.actorName.includes(q) || e.refNumber.includes(q));
    }
    return list;
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
  }

  onFilterChange(value: SubscriptionLogActionType | 'all'): void {
    this.actionFilter = value;
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }
}
