import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { SubscriptionOrder, SubscriptionOrderItem, isAutoTopUpOrder, subscriptionLineTotal } from '../../interfaces/subscription.model';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';

// Known paymentMethod values get a translated label; anything else is shown as sent.
const PAYMENT_METHOD_KEYS: Record<string, string> = {
  merchantwallet: 'wallet',
  wallet: 'wallet',
  mada: 'mada',
  visa: 'visa',
  mastercard: 'mastercard',
  master: 'mastercard',
  applepay: 'applePay',
  card: 'card',
};
import { orderStatusKind, OrderStatusKind } from '../request-status.util';
import { serviceVisual } from '../../interfaces/service-visual.util';

/** Read-only order details — orders are activated on payment, the admin doesn't approve or reject them. */
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
  @Input() logoByServiceId = new Map<number, string | null>();
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

  /** VAT rate isn't returned — derived from the server's own subtotal/tax so it never disagrees with them. */
  get taxPercent(): number | null {
    const o = this.order;
    if (!o || !o.subtotalAmount) return null;
    return Math.round((o.taxAmount / o.subtotalAmount) * 100);
  }

  lineTotal(item: SubscriptionOrderItem): number {
    return subscriptionLineTotal(item);
  }

  get isAutoTopUp(): boolean {
    return !!this.order && isAutoTopUpOrder(this.order);
  }

  /** null when the order doesn't carry a payment method. */
  get paymentMethodLabel(): string | null {
    const raw = this.order?.paymentMethod?.trim();
    if (!raw) return null;
    const key = PAYMENT_METHOD_KEYS[raw.toLowerCase().replace(/[\s_-]/g, '')];
    return key ? this.translate.instant(`d3.subscriptionRequests.detail.paymentMethods.${key}`) : raw;
  }

  fmtCount(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  /** Logo URLs that failed to load — the service icon is shown instead of a broken image. */
  private readonly brokenLogos = new Set<string>();

  logoOf(item: SubscriptionOrderItem): string | null {
    const url = this.logoByServiceId.get(item.subscriptionServiceId) ?? null;
    return url && !this.brokenLogos.has(url) ? url : null;
  }

  onLogoError(url: string): void {
    this.brokenLogos.add(url);
  }

  iconOf(item: SubscriptionOrderItem): string {
    return serviceVisual(item.serviceKey).icon;
  }

  fmtAmount(value: number): string {
    return value.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA', { maximumFractionDigits: 2 });
  }

  close(): void {
    this.closed.emit();
  }
}
