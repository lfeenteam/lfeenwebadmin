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
import { LoginService } from '../../services/login/login.service';
import { ListingBanRefund, RefundStatus } from '../../interfaces/listing-ban.model';
import { RefundResolveDialogComponent, RefundResolveDialogData } from './refund-resolve-dialog/refund-resolve-dialog.component';

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
    { id: 'ManualReview', labelKey: 'd3.banRefunds.status.manualReview' },
    { id: 'Pending',      labelKey: 'd3.banRefunds.status.pending'      },
    { id: 'Succeeded',    labelKey: 'd3.banRefunds.status.succeeded'    },
    { id: 'Resolved',     labelKey: 'd3.banRefunds.status.resolved'     },
    { id: 'All',          labelKey: 'd3.banRefunds.tabs.all'            },
  ];

  activeTab: RefundTab = 'ManualReview';
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

  retry(row: ListingBanRefund): void {
    if (this.busyIds.has(row.id)) return;
    this.busyIds.add(row.id);
    this.banService.retryRefund(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.busyIds.delete(row.id);
        this.retryingIds.add(row.id);
        this.replaceRow(updated);
        this.toastr.info(this.translate.instant('d3.banRefunds.toast.retryQueued'));
        // Check back once the background attempt has had time to run.
        timer(RETRY_REFRESH_DELAY_MS).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
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
    const fallback = err?.status === 403
      ? 'd3.listingBan.errors.forbidden'
      : err?.status === 0 || err?.status >= 500
        ? 'd3.listingBan.errors.serviceUnavailable'
        : 'd3.toast.errorOp';
    this.toastr.error(this.translate.instant(fallback));
  }

  statusMeta(row: ListingBanRefund) {
    return STATUS_META[row.status] ?? { key: row.status, cls: 'st-neutral' };
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

  fmtAmount(row: ListingBanRefund): string {
    const amount = row.amount.toLocaleString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-EG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return row.currencyCode ? `${amount} ${row.currencyCode}` : amount;
  }
}
