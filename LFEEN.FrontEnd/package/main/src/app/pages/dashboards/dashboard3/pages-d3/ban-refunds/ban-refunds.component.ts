import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subscription, timer } from 'rxjs';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { ListingBanService } from '../../services/listing-ban.service';
import { transportErrorMessage } from '../../utils/transport-error.util';
import { LoginService } from '../../services/login/login.service';
import { ListingBanRefund, RefundStatus } from '../../interfaces/listing-ban.model';
import { RefundResolveDialogComponent, RefundResolveDialogData } from './refund-resolve-dialog/refund-resolve-dialog.component';
import { RefundRetryDialogComponent, RefundRetryDialogData } from './refund-retry-dialog/refund-retry-dialog.component';
import { appLocale } from 'src/app/utils/locale-format.util';

type RefundTab = RefundStatus | 'All';

const PAGE_SIZE = 20;
// The retry itself runs in the background a few seconds after the API returns.
const RETRY_REFRESH_DELAY_MS = 8000;

const STATUS_META: Record<RefundStatus, { key: string; cls: string }> = {
  Pending:      { key: 'd3.banRefunds.status.pending',      cls: 'st-pending'  },
  Succeeded:    { key: 'd3.banRefunds.status.succeeded',    cls: 'st-success'  },
  ManualReview: { key: 'd3.banRefunds.status.manualReview', cls: 'st-danger'   },
  Resolved:     { key: 'd3.banRefunds.status.resolved',     cls: 'st-neutral'  },
};

// failureReasonCode → translation key; fallback for when the backend sends no localized failureReason.
const FAILURE_REASON_KEYS: Record<string, string> = {
  GATEWAY_ERROR:          'd3.banRefunds.failureReasons.gatewayError',
  REQUIRES_MANUAL_REVIEW: 'd3.banRefunds.failureReasons.requiresManualReview',
  MAX_ATTEMPTS_REACHED:   'd3.banRefunds.failureReasons.maxAttemptsReached',
  UNKNOWN:                'd3.banRefunds.failureReasons.unknown',
};

// errorCode → translation key; all of these mean the row changed underneath us, so reload.
const ERROR_KEYS: Record<string, string> = {
  REFUND_NOT_IN_MANUAL_REVIEW: 'd3.banRefunds.errors.notInManualReview',
  NOT_FOUND:                   'd3.banRefunds.errors.notFound',
};

@Component({
  selector: 'app-ban-refunds',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, MatTooltipModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './ban-refunds.component.html',
  styleUrl: './ban-refunds.component.scss'
})
export class BanRefundsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private banService = inject(ListingBanService);
  private login = inject(LoginService);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private dialog = inject(MatDialog);

  readonly canManage = computed(() => this.login.permissions().some(p => p.toLowerCase() === 'banrefunds.manage'));

  readonly tabs: { id: RefundTab; labelKey: string }[] = [
    { id: 'All',          labelKey: 'd3.banRefunds.tabs.all'            },
    { id: 'ManualReview', labelKey: 'd3.banRefunds.status.manualReview' },
    { id: 'Pending',      labelKey: 'd3.banRefunds.status.pending'      },
    { id: 'Succeeded',    labelKey: 'd3.banRefunds.status.succeeded'    },
    { id: 'Resolved',     labelKey: 'd3.banRefunds.status.resolved'     },
  ];

  activeTab: RefundTab = 'All';
  rows: ListingBanRefund[] = [];
  currentPage = 1;
  totalCount = 0;
  loading = false;
  loadError = false;
  /** Row ids with a retry/resolve request in flight. */
  busyIds = new Set<number>();
  /** Rows retried in this session and waiting for the background attempt. */
  retryingIds = new Set<number>();

  private loadSub?: Subscription;
  private refreshSub?: Subscription;

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / PAGE_SIZE));
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  ngOnInit(): void {
    this.load();
    // failureReason comes back localized (Accept-Language), so the rows must be refetched.
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  setTab(tab: RefundTab): void {
    if (tab === this.activeTab) return;
    this.activeTab = tab;
    this.currentPage = 1;
    this.load();
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.load();
  }

  load(): void {
    this.loadSub?.unsubscribe();
    this.loading = true;
    this.loadError = false;
    const status = this.activeTab === 'All' ? null : this.activeTab;
    this.loadSub = this.banService.getRefunds(status, this.currentPage, PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.rows = res.items;
          this.totalCount = res.totalCount;
          this.loading = false;
          // A row that finished its background attempt is no longer "retrying".
          for (const r of res.items) {
            if (r.status !== 'Pending') this.retryingIds.delete(r.id);
          }
        },
        error: () => {
          this.rows = [];
          this.loading = false;
          this.loadError = true;
        },
      });
  }

  /** Re-sends the refund to the gateway, so it asks first. The row stays locked until the dialog closes. */
  retry(row: ListingBanRefund): void {
    if (this.busyIds.has(row.id) || this.retryingIds.has(row.id)) return;
    this.busyIds.add(row.id);
    this.dialog
      .open<RefundRetryDialogComponent, RefundRetryDialogData, true | undefined>(RefundRetryDialogComponent, {
        width: '480px',
        maxWidth: '95vw',
        panelClass: 'refund-resolve-dialog-panel',
        data: { bookingNumber: row.bookingNumber, guestName: row.guestName, amount: this.fmtAmount(row) },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(confirmed => {
        if (confirmed) this.sendRetry(row);
        else this.busyIds.delete(row.id);
      });
  }

  /** One request per confirmation; the backend rejects a second one with REFUND_NOT_IN_MANUAL_REVIEW. */
  private sendRetry(row: ListingBanRefund): void {
    this.banService.retryRefund(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        // Mark it retrying before freeing it, so the buttons never come back in between.
        this.retryingIds.add(row.id);
        this.busyIds.delete(row.id);
        this.replaceRow(updated);
        this.toastr.info(this.translate.instant('d3.banRefunds.toast.retryQueued'));
        this.scheduleRefresh();
      },
      error: err => {
        this.busyIds.delete(row.id);
        this.handleError(err);
      },
    });
  }

  resolve(row: ListingBanRefund): void {
    if (this.busyIds.has(row.id)) return;
    this.dialog
      .open<RefundResolveDialogComponent, RefundResolveDialogData, string | null | undefined>(RefundResolveDialogComponent, {
        width: '480px',
        maxWidth: '95vw',
        panelClass: 'refund-resolve-dialog-panel',
        data: { bookingNumber: row.bookingNumber, amount: this.fmtAmount(row) },
      })
      .afterClosed()
      .subscribe(note => {
        // undefined = dismissed; null or text = confirmed (the note is optional).
        if (note === undefined) return;
        this.busyIds.add(row.id);
        this.banService.markRefundResolved(row.id, note).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.busyIds.delete(row.id);
            this.toastr.success(this.translate.instant('d3.banRefunds.toast.resolved'));
            this.load();
          },
          error: err => {
            this.busyIds.delete(row.id);
            this.handleError(err);
          },
        });
      });
  }

  /** Check back once the background attempt has had time to run; one pending refresh covers every retry. */
  private scheduleRefresh(): void {
    this.refreshSub?.unsubscribe();
    this.refreshSub = timer(RETRY_REFRESH_DELAY_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  private replaceRow(updated: ListingBanRefund): void {
    this.rows = this.rows.map(r => (r.id === updated.id ? { ...r, ...updated } : r));
  }

  private handleError(err: HttpErrorResponse): void {
    const key = ERROR_KEYS[err?.error?.errorCode ?? ''];
    if (key) {
      this.toastr.error(this.translate.instant(key));
      this.load();
      return;
    }
    const validationMessage: string | undefined = err?.error?.errors?.[0]?.message;
    if (err?.status === 400 && validationMessage) {
      this.toastr.error(validationMessage);
      return;
    }
    const transport = transportErrorMessage(err, this.translate);
    if (transport) {
      this.toastr.error(transport);
      return;
    }
    const fallback = err?.status === 403
      ? 'd3.listingBan.errors.forbidden'
      : err?.status === 0 || err?.status >= 500
        ? 'd3.listingBan.errors.serviceUnavailable'
        : 'd3.toast.errorOp';
    this.toastr.error(this.translate.instant(fallback));
  }

  /** Rows whose technical details are expanded. */
  expandedErrorIds = new Set<number>();

  toggleError(id: number): void {
    if (this.expandedErrorIds.has(id)) this.expandedErrorIds.delete(id);
    else this.expandedErrorIds.add(id);
  }

  /** Legacy rows for unpaid bookings: "Succeeded" with nothing actually refunded. */
  isNothingToRefund(row: ListingBanRefund): boolean {
    return row.status === 'Succeeded' && !row.amount;
  }

  statusMeta(row: ListingBanRefund) {
    if (this.isNothingToRefund(row)) return { key: 'd3.banRefunds.status.nothingToRefund', cls: 'st-neutral' };
    return STATUS_META[row.status] ?? { key: row.status, cls: 'st-neutral' };
  }

  /** "Lamira Villas" — falls back to "Building #4" when the name is missing. */
  propertyLabel(row: ListingBanRefund): string | null {
    if (row.propertyName?.trim()) return row.propertyName;
    return row.propertyId ? this.translate.instant('d3.banRefunds.table.property', { id: row.propertyId }) : null;
  }

  /** "Unit 444" — falls back to "Unit #27" when the number is missing. */
  unitLabel(row: ListingBanRefund): string | null {
    if (row.unitNumber?.trim()) return this.translate.instant('d3.banRefunds.table.unitNumber', { number: row.unitNumber });
    return row.unitId ? this.translate.instant('d3.banRefunds.table.unit', { id: row.unitId }) : null;
  }

  /** Readable failure reason: the backend's localized text, else ours by code, else nothing. */
  failureLabel(row: ListingBanRefund): string | null {
    if (row.failureReason?.trim()) return row.failureReason;
    const key = FAILURE_REASON_KEYS[row.failureReasonCode ?? ''];
    if (key) return this.translate.instant(key);
    return row.failureReasonCode ? this.translate.instant(FAILURE_REASON_KEYS['UNKNOWN']) : null;
  }

  fmtDate(iso: string | null): string {
    return formatApiDateLocal(iso, this.translate.currentLang, true) ?? '—';
  }

  fmt(n: number): string {
    return formatLocalizedNumber(n, this.translate.currentLang);
  }

  /** Number only — the table renders the riyal symbol next to it (see `isSar`). */
  fmtAmountValue(row: ListingBanRefund): string {
    return row.amount.toLocaleString(appLocale(this.translate.currentLang), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  /** Plain-text amount for places that can't show the icon (e.g. the resolve dialog copy). */
  fmtAmount(row: ListingBanRefund): string {
    const amount = this.fmtAmountValue(row);
    if (!row.currencyCode) return amount;
    const currency = this.isSar(row) ? this.translate.instant('d3.banRefunds.currencySar') : row.currencyCode;
    return `${amount} ${currency}`;
  }

  isSar(row: ListingBanRefund): boolean {
    return !row.currencyCode || row.currencyCode.toUpperCase() === 'SAR';
  }

  get currencyIconSrc(): string {
    return this.translate.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get currencyIconEn(): boolean {
    return this.translate.currentLang === 'en';
  }
}
