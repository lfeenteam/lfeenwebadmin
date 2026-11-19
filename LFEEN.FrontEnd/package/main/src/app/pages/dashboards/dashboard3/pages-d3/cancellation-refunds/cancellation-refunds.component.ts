import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subscription, timer } from 'rxjs';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { appLocale } from 'src/app/utils/locale-format.util';
import { MatDialog } from '@angular/material/dialog';
import { LoginService } from '../../services/login/login.service';
import { transportErrorMessage } from '../../utils/transport-error.util';
import {
  CANCELLATION_REFUND_PERMISSIONS, CancellationRefund, hasCancellationRefundPermission, isRetryable,
} from './cancellation-refund.model';
import { CancellationRefundsService } from './cancellation-refunds.service';
import {
  CancellationResolveDialogComponent, CancellationResolveDialogData, CancellationResolveResult,
} from './cancellation-resolve-dialog/cancellation-resolve-dialog.component';

const PAGE_SIZE = 20;
// The backend picks a re-queued job up within ~30s, so check back a little after that.
const RETRY_REFRESH_DELAY_MS = 40000;

// errorCode → translation key; both mean the row changed underneath us, so reload.
const ERROR_KEYS: Record<string, string> = {
  REFUND_NOT_IN_MANUAL_REVIEW: 'd3.cancellationRefunds.errors.notInManualReview',
  NOT_FOUND:                   'd3.cancellationRefunds.errors.notFound',
};

// failureReasonCode → translation key; fallback for when the backend sends no localized failureReason.
const FAILURE_REASON_KEYS: Record<string, string> = {
  MANUAL_REFUND_REQUIRED: 'd3.cancellationRefunds.failureReasons.manualRefundRequired',
  GATEWAY_ERROR:          'd3.cancellationRefunds.failureReasons.gatewayError',
  MAX_ATTEMPTS_REACHED:   'd3.cancellationRefunds.failureReasons.maxAttemptsReached',
  REQUIRES_MANUAL_REVIEW: 'd3.cancellationRefunds.failureReasons.requiresManualReview',
  UNKNOWN:                'd3.cancellationRefunds.failureReasons.unknown',
};

/** Guest-cancellation refunds stuck in ManualReview, with a per-row "Retry". */
@Component({
  selector: 'app-cancellation-refunds',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, MatTooltipModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './cancellation-refunds.component.html',
  // Same table as Ban Refunds (classes prefixed "br-").
  styleUrl: '../ban-refunds/ban-refunds.component.scss'
})
export class CancellationRefundsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private service = inject(CancellationRefundsService);
  private login = inject(LoginService);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private dialog = inject(MatDialog);

  readonly canManage = computed(() =>
    hasCancellationRefundPermission(this.login, CANCELLATION_REFUND_PERMISSIONS.manage));

  /** Retry can't fix MANUAL_REFUND_REQUIRED & co. — those only close with "mark resolved". */
  readonly isRetryable = isRetryable;

  rows: CancellationRefund[] = [];
  currentPage = 1;
  totalCount = 0;
  loading = false;
  loadError = false;
  /** Row ids with a retry request in flight. */
  busyIds = new Set<number>();
  /** Rows re-queued in this session, waiting for the backend to pick them up. */
  queuedIds = new Set<number>();
  /** Rows whose technical details are expanded. */
  expandedErrorIds = new Set<number>();

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
    // Error messages come back localized (Accept-Language), so refetch on language change.
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
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
    this.loadSub = this.service.getList(this.currentPage, PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.rows = res.items;
          this.totalCount = res.totalCount;
          this.loading = false;
          // A queued row that is back here with attempts > 0 failed again; one that's gone was picked up.
          const back = new Set(res.items.filter(r => r.attempts > 0).map(r => r.id));
          for (const id of [...this.queuedIds]) {
            if (back.has(id) || !res.items.some(r => r.id === id)) this.queuedIds.delete(id);
          }
          // The last row of a page can disappear after a retry.
          if (this.currentPage > this.totalPages) this.changePage(this.totalPages);
        },
        error: () => {
          this.rows = [];
          this.loading = false;
          this.loadError = true;
        },
      });
  }

  /** One request per click; never retried automatically (a second send just gets REFUND_NOT_IN_MANUAL_REVIEW). */
  retry(row: CancellationRefund): void {
    if (this.busyIds.has(row.id) || this.queuedIds.has(row.id)) return;
    this.busyIds.add(row.id);
    this.service.retry(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.busyIds.delete(row.id);
        this.queuedIds.add(row.id);
        this.rows = this.rows.map(r => (r.id === updated.id ? { ...r, ...updated } : r));
        this.toastr.info(this.translate.instant('d3.cancellationRefunds.toast.retryQueued'));
        this.scheduleRefresh();
      },
      error: err => {
        this.busyIds.delete(row.id);
        this.handleError(err);
      },
    });
  }

  resolve(row: CancellationRefund): void {
    if (this.busyIds.has(row.id) || this.queuedIds.has(row.id)) return;
    this.busyIds.add(row.id);
    this.dialog
      .open<CancellationResolveDialogComponent, CancellationResolveDialogData, CancellationResolveResult | undefined>(
        CancellationResolveDialogComponent, {
          width: '480px',
          maxWidth: '95vw',
          // The dialog owns the request; a stray backdrop click mustn't hide one in flight.
          disableClose: true,
          data: { row, currencyLabel: this.currencyLabel(row) },
        })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        this.busyIds.delete(row.id);
        if (!result) return;
        if (result.kind === 'stale') {
          this.toastr.error(result.message);
        } else {
          this.toastr.success(this.translate.instant('d3.cancellationRefunds.toast.resolved'));
        }
        // Either way the row has left ManualReview.
        this.load();
      });
  }

  /** One pending refresh covers every retry clicked before it fires. */
  private scheduleRefresh(): void {
    this.refreshSub?.unsubscribe();
    this.refreshSub = timer(RETRY_REFRESH_DELAY_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());
  }

  private handleError(err: HttpErrorResponse): void {
    const key = ERROR_KEYS[err?.error?.errorCode ?? ''];
    if (key) {
      this.toastr.error(err?.error?.message?.trim() || this.translate.instant(key));
      this.load();
      return;
    }
    const message: string | undefined = err?.error?.errors?.[0]?.message ?? err?.error?.message;
    if (err?.status === 400 && message?.trim()) {
      this.toastr.error(message);
      return;
    }
    const transport = transportErrorMessage(err, this.translate);
    if (transport) {
      this.toastr.error(transport);
      return;
    }
    const fallback = err?.status === 403
      ? 'd3.cancellationRefunds.errors.forbidden'
      : err?.status === 0 || err?.status >= 500
        ? 'd3.cancellationRefunds.errors.network'
        : 'd3.toast.errorOp';
    this.toastr.error(this.translate.instant(fallback));
  }

  toggleError(id: number): void {
    if (this.expandedErrorIds.has(id)) this.expandedErrorIds.delete(id);
    else this.expandedErrorIds.add(id);
  }

  /** "Lamira Villas" — falls back to "Building #4" when the name is missing. */
  propertyLabel(row: CancellationRefund): string | null {
    if (row.propertyName?.trim()) return row.propertyName;
    return row.propertyId ? this.translate.instant('d3.cancellationRefunds.table.property', { id: row.propertyId }) : null;
  }

  /** "Unit 7" — falls back to "Unit #42" when the number is missing. */
  unitLabel(row: CancellationRefund): string | null {
    if (row.unitNumber?.trim()) return this.translate.instant('d3.cancellationRefunds.table.unitNumber', { number: row.unitNumber });
    return row.unitId ? this.translate.instant('d3.cancellationRefunds.table.unit', { id: row.unitId }) : null;
  }

  /** Readable failure reason: the backend's localized text, else ours by code, else nothing. */
  failureLabel(row: CancellationRefund): string | null {
    if (row.failureReason?.trim()) return row.failureReason;
    const code = (row.failureReasonCode ?? '').toUpperCase();
    if (!code) return null;
    return this.translate.instant(FAILURE_REASON_KEYS[code] ?? FAILURE_REASON_KEYS['UNKNOWN']);
  }

  private currencyLabel(row: CancellationRefund): string {
    return this.isSar(row) ? this.translate.instant('d3.cancellationRefunds.currencySar') : (row.currencyCode ?? '');
  }

  fmtDate(iso: string | null): string {
    return formatApiDateLocal(iso, this.translate.currentLang, true) ?? '—';
  }

  fmt(n: number): string {
    return formatLocalizedNumber(n, this.translate.currentLang);
  }

  fmtAmountValue(row: CancellationRefund): string {
    return (row.amount ?? 0).toLocaleString(appLocale(this.translate.currentLang), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  isSar(row: CancellationRefund): boolean {
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
