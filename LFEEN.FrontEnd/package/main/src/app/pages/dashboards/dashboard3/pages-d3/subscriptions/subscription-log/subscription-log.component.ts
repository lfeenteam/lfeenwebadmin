import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { SubscriptionLogActionType, SubscriptionLogEntry, SubscriptionOrder } from '../interfaces/subscription.model';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { SubscriptionsService } from '../../../services/subscriptions.service';

const SERVICE_ICON_BY_KEY: Record<string, string> = {
  'ntmp-compliance': 'receipt',
  'whatsapp-business': 'brand-whatsapp',
  'rasd': 'map-pin',
  'zatca': 'receipt',
  'payments': 'credit-card',
  'sms': 'message-2',
  'erp-connect': 'plug',
};
const DEFAULT_SERVICE_ICON = 'apps';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-subscription-log',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './subscription-log.component.html',
  styleUrl: './subscription-log.component.scss'
})
export class SubscriptionLogComponent implements OnInit {
  private translate = inject(TranslateService);
  private subscriptionsService = inject(SubscriptionsService);

  isLoading = true;
  searchQuery = '';
  actionFilter: SubscriptionLogActionType | 'all' = 'all';
  currentPage = 1;

  private allEntries: SubscriptionLogEntry[] = [];

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

  ngOnInit(): void {
    this.subscriptionsService.getAllRequests().subscribe({
      next: (orders) => {
        this.allEntries = this.mapOrdersToEntries(orders);
        this.isLoading = false;
      },
      error: () => {
        this.allEntries = [];
        this.isLoading = false;
      }
    });
  }

  private mapOrdersToEntries(orders: SubscriptionOrder[]): SubscriptionLogEntry[] {
    const entries: SubscriptionLogEntry[] = [];
    for (const order of orders) {
      const status = this.mapStatus(order.status);
      const dateSource = order.processedAt ?? order.requestedAt;
      for (const item of order.items) {
        entries.push({
          id: entries.length + 1,
          refNumber: '#' + order.orderId.slice(0, 8).toUpperCase(),
          actionType: this.classifyActionType(item.requestTypeLabel),
          actionLabel: item.requestTypeLabel,
          serviceName: item.serviceName,
          serviceIcon: SERVICE_ICON_BY_KEY[item.serviceKey] ?? DEFAULT_SERVICE_ICON,
          actorName: '-',
          actorInitial: '-',
          date: new Date(dateSource),
          status,
        });
      }
    }
    return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  // requestTypeLabel is a free-text display string from the API, not a fixed enum,
  // so this only picks a badge color — the visible text always comes from actionLabel.
  private classifyActionType(label: string): SubscriptionLogActionType {
    const normalized = label.toLowerCase();
    if (normalized.includes('renew')) return 'renew';
    if (normalized.includes('unsub') || normalized.includes('cancel')) return 'cancel';
    return 'add';
  }

  private mapStatus(status: SubscriptionOrder['status']): SubscriptionLogEntry['status'] {
    switch (status) {
      case 'Approved': return 'completed';
      case 'Rejected': return 'cancelled';
      default: return 'processing'; // Pending and UnderReview both read as "in progress" here
    }
  }

  private get filteredBeforePaging(): SubscriptionLogEntry[] {
    let list = this.allEntries;
    if (this.actionFilter !== 'all') {
      list = list.filter(e => e.actionType === this.actionFilter);
    }
    const q = this.searchQuery.trim();
    if (q) {
      list = list.filter(e => e.serviceName.includes(q) || e.refNumber.includes(q));
    }
    return list;
  }

  get filteredEntries(): SubscriptionLogEntry[] {
    const start = (this.currentPage - 1) * PAGE_SIZE;
    return this.filteredBeforePaging.slice(start, start + PAGE_SIZE);
  }

  get totalCount(): number {
    return this.filteredBeforePaging.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / PAGE_SIZE));
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.currentPage = 1;
  }

  onFilterChange(value: SubscriptionLogActionType | 'all'): void {
    this.actionFilter = value;
    this.currentPage = 1;
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }
}
