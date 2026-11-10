import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { SubscriptionCatalogItem, SubscriptionOrder, SubscriptionOrderItem, subscriptionLineTotal } from '../../interfaces/subscription.model';
import { orderStatusKind, OrderStatusKind } from '../request-status.util';
import { serviceVisual } from '../../interfaces/service-visual.util';
import { periodText } from '../../interfaces/period-text.util';
import { appLocale } from 'src/app/utils/locale-format.util';

/** Read-only order details — orders activate on payment, the admin doesn't approve or reject them. */
@Component({
  selector: 'app-request-detail-drawer',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './request-detail-drawer.component.html',
  styleUrl: './request-detail-drawer.component.scss'
})
export class RequestDetailDrawerComponent implements OnChanges, OnDestroy {
  private translate = inject(TranslateService);

  @Input() order: SubscriptionOrder | null = null;
  @Input() catalogById = new Map<number, SubscriptionCatalogItem>();
  @Output() closed = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['order']) {
      document.body.style.overflow = this.order ? 'hidden' : '';
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.order) this.close();
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get currencyIconEn(): boolean {
    return this.currentLang === 'en';
  }

  lineKind(status: string | null | undefined): OrderStatusKind {
    return orderStatusKind(status);
  }

  // lineStatus has no label field — known values reuse the tab labels, anything else shows raw.
  lineStatusLabel(status: string | null | undefined): string {
    const kind = orderStatusKind(status);
    return kind === 'other' ? (status || '—') : this.translate.instant(`d3.subscriptionRequests.tabs.${kind}`);
  }

  get kind(): OrderStatusKind {
    return orderStatusKind(this.order?.status);
  }

  get requestedAtLabel(): string {
    return formatApiDateLocal(this.order?.requestedAt, this.currentLang) ?? '-';
  }

  get processedAtLabel(): string | null {
    return formatApiDateLocal(this.order?.processedAt, this.currentLang, true);
  }

  /** Package lines carry the chosen option's own name; "None" means the line has no period. */
  periodOf(item: SubscriptionOrderItem): string {
    return periodText(item.periodLabel, item.period) || '—';
  }

  /** A Transaction line's per-operation rate, or null for any other line. */
  usageRateOf(item: SubscriptionOrderItem): { percent: number | null; amount: number | null } | null {
    const price = item.usageUnitPrice;
    if (typeof price !== 'number' || !item.usageUnitType || item.usageUnitType === 'None') return null;
    return item.usageUnitType === 'PercentageOfValue'
      ? { percent: price * 100, amount: null }
      : { percent: null, amount: price };
  }

  lineTotal(item: SubscriptionOrderItem): number {
    return subscriptionLineTotal(item);
  }

  /** Logo URLs that failed to load — the service icon is shown instead of a broken image. */
  private readonly brokenLogos = new Set<string>();

  logoOf(item: SubscriptionOrderItem): string | null {
    const url = this.catalogById.get(item.subscriptionServiceId)?.logoUrl ?? null;
    return url && !this.brokenLogos.has(url) ? url : null;
  }

  // The order line's serviceName comes back in Arabic only; the catalog has both languages.
  nameOf(item: SubscriptionOrderItem): string {
    const c = this.catalogById.get(item.subscriptionServiceId);
    return (c && (this.currentLang === 'en' ? c.nameEn : c.nameAr)) || item.serviceName;
  }

  onLogoError(url: string): void {
    this.brokenLogos.add(url);
  }

  iconOf(item: SubscriptionOrderItem): string {
    return serviceVisual(item.serviceKey).icon;
  }

  fmtAmount(value: number): string {
    return value.toLocaleString(appLocale(this.currentLang), { maximumFractionDigits: 2 });
  }

  fmtPrecise(value: number): string {
    return value.toLocaleString(appLocale(this.currentLang), { maximumFractionDigits: 4 });
  }

  close(): void {
    this.closed.emit();
  }
}
