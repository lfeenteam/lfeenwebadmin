import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { SubscriptionsService } from '../../../../services/subscriptions.service';
import { SubscriptionOrder, SubscriptionOrderItem, subscriptionLineTotal } from '../../interfaces/subscription.model';
import { isStaleSubscriptionError, resolveSubscriptionError } from '../../interfaces/subscription-error.util';
import { orderStatusKind, OrderStatusKind } from '../request-status.util';
import { serviceVisual } from '../../interfaces/service-visual.util';

/** `updated` = the order was approved/rejected; `refresh` = it changed server-side, reload the list. */
export type RequestDrawerResult =
  | { type: 'updated'; order: SubscriptionOrder }
  | { type: 'refresh' }
  | undefined;

type DrawerStep = 'details' | 'approve' | 'reject';

const NOTE_MAX = 1000;

@Component({
  selector: 'app-request-detail-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './request-detail-drawer.component.html',
  styleUrl: './request-detail-drawer.component.scss'
})
export class RequestDetailDrawerComponent implements OnChanges, OnDestroy {
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private service = inject(SubscriptionsService);

  @Input() order: SubscriptionOrder | null = null;
  @Input() logoByServiceId = new Map<number, string | null>();
  @Input() canApprove = false;
  @Input() canReject = false;
  @Output() closed = new EventEmitter<RequestDrawerResult>();

  readonly noteMax = NOTE_MAX;

  step: DrawerStep = 'details';
  submitting = false;
  approveNote = '';
  rejectReason = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['order']) {
      this.step = 'details';
      this.approveNote = '';
      this.rejectReason = '';
      this.submitting = false;
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

  get kind(): OrderStatusKind {
    return orderStatusKind(this.order?.status);
  }

  get showActions(): boolean {
    return this.kind === 'underReview' && (this.canApprove || this.canReject);
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

  get canConfirmReject(): boolean {
    const reason = this.rejectReason.trim();
    return !this.submitting && !!reason && reason.length <= NOTE_MAX;
  }

  lineTotal(item: SubscriptionOrderItem): number {
    return subscriptionLineTotal(item);
  }

  logoOf(item: SubscriptionOrderItem): string | null {
    return this.logoByServiceId.get(item.subscriptionServiceId) ?? null;
  }

  iconOf(item: SubscriptionOrderItem): string {
    return serviceVisual(item.serviceKey).icon;
  }

  fmtAmount(value: number): string {
    return value.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA', { maximumFractionDigits: 2 });
  }

  setStep(step: DrawerStep): void {
    if (this.submitting) return;
    this.step = step;
  }

  confirmApprove(): void {
    if (!this.order || this.submitting) return;
    this.submitting = true;
    this.service.approveOrder(this.order.orderId, this.approveNote.trim() || undefined).subscribe({
      next: updated => {
        this.toastr.success(this.translate.instant('d3.subscriptionRequests.detail.approvedToast'));
        this.finish(this.withStatus(updated, 'Approved'));
      },
      error: err => this.handleError(err),
    });
  }

  confirmReject(): void {
    if (!this.order || !this.canConfirmReject) return;
    this.submitting = true;
    this.service.rejectOrder(this.order.orderId, this.rejectReason.trim()).subscribe({
      next: updated => {
        this.toastr.success(this.translate.instant('d3.subscriptionRequests.detail.rejectedToast'));
        this.finish(this.withStatus(updated, 'Rejected'));
      },
      error: err => this.handleError(err),
    });
  }

  close(): void {
    if (this.submitting) return;
    this.closed.emit(undefined);
  }

  // The response's raw status may be numeric — pin it to the action we just took so the row lands in the right tab.
  private withStatus(order: SubscriptionOrder, status: 'Approved' | 'Rejected'): SubscriptionOrder {
    return orderStatusKind(order?.status) === 'other' ? { ...order, status } : order;
  }

  private finish(order: SubscriptionOrder): void {
    this.submitting = false;
    this.closed.emit({ type: 'updated', order });
  }

  private handleError(err: unknown): void {
    this.submitting = false;
    this.toastr.error(resolveSubscriptionError(err, this.translate));
    // Already processed by someone else (409) or gone (404) — nothing here can succeed anymore.
    if (isStaleSubscriptionError(err)) {
      this.closed.emit({ type: 'refresh' });
    }
  }
}
