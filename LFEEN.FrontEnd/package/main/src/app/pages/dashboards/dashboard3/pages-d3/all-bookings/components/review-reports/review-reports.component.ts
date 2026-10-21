import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subscription, filter, switchMap } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { relativeTime } from '../../../notifications/notification-presentation';
import {
  OfferConfirmDialogComponent,
  OfferConfirmDialogData,
} from '../../../platform-offers/components/offer-confirm-dialog/offer-confirm-dialog.component';
import { BookingService } from '../../services/booking.service';
import {
  REVIEW_TARGET_FIELD_ICON,
  REVIEW_TARGET_FIELD_LABEL_KEY,
  ReviewReportItem,
  isReviewReportGone,
  reviewReportErrorMessage,
  reviewReportKey,
} from '../../interfaces/review-report.model';
import { ApproveReviewDialogComponent, ApproveReviewDialogResult } from '../approve-review-dialog/approve-review-dialog.component';

export interface ReviewReportsCount {
  total: number;
  highPriority: number;
}

interface ReasonGroup {
  text: string;
  count: number;
}

interface ReviewReportRow {
  key: string;
  item: ReviewReportItem;
  targetLabelKey: string;
  targetIcon: string;
  reasonGroups: ReasonGroup[];
  /** Reporters who left the reason blank. */
  silentCount: number;
}

@Component({
  selector: 'app-review-reports',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, MaterialModule, DashboardLoadingComponent],
  // Dialogs are opened imperatively via MatDialog, so they are not listed in `imports`.
  templateUrl: './review-reports.component.html',
  styleUrl: './review-reports.component.scss'
})
export class ReviewReportsComponent implements OnInit {
  /** Bookings.Update — without it the queue is read-only. */
  @Input() canModerate = false;
  /** Fired after every load and every action so the parent's tab badge stays in sync. */
  @Output() countChange = new EventEmitter<ReviewReportsCount>();

  private bookingService = inject(BookingService);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  rows: ReviewReportRow[] = [];
  loading = false;
  loadError = false;
  forbidden = false;
  /** Rows with a reject request in flight. */
  busyKeys = new Set<string>();

  private loadSub?: Subscription;

  get currentLang(): string {
    return this.translate.currentLang || this.translate.defaultLang || 'ar';
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get highPriorityCount(): number {
    return this.rows.filter(r => r.item.isHighPriority).length;
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loadSub?.unsubscribe();
    this.loading = true;
    this.loadError = false;
    this.forbidden = false;
    this.loadSub = this.bookingService.getReviewReports()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => {
          // Already sorted server-side (high priority → report count → oldest) — keep that order.
          this.rows = items.map(item => this.toRow(item));
          this.loading = false;
          this.emitCount();
        },
        error: (err: HttpErrorResponse) => {
          this.rows = [];
          this.loading = false;
          this.forbidden = err?.status === 403;
          this.loadError = !this.forbidden;
          this.emitCount();
        },
      });
  }

  openApprove(row: ReviewReportRow): void {
    if (!this.canModerate || this.busyKeys.has(row.key)) return;
    this.dialog.open<ApproveReviewDialogComponent, ReviewReportItem, ApproveReviewDialogResult>(ApproveReviewDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'approve-review-dialog-panel',
      data: row.item,
    })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      // The dialog performs the request and its own toast; 'gone' means it was already actioned.
      .subscribe(result => {
        if (result) this.removeRow(row.key);
      });
  }

  openReject(row: ReviewReportRow): void {
    if (!this.canModerate || this.busyKeys.has(row.key)) return;
    this.dialog.open<OfferConfirmDialogComponent, OfferConfirmDialogData, boolean>(OfferConfirmDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      data: {
        title: 'd3.bookings.reviewReports.rejectDialog.title',
        message: row.item.isHighPriority
          ? 'd3.bookings.reviewReports.rejectDialog.messageHidden'
          : 'd3.bookings.reviewReports.rejectDialog.messageVisible',
        confirmLabel: 'd3.bookings.reviewReports.actions.reject',
        icon: 'shield-x',
        tone: 'warning',
      },
    })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.busyKeys.add(row.key);
          return this.bookingService.rejectReviewReport(row.item.bookingReviewId, row.item.targetField);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.busyKeys.delete(row.key);
          this.toastr.success(this.translate.instant('d3.bookings.reviewReports.toast.rejected'));
          this.removeRow(row.key);
        },
        error: (err: HttpErrorResponse) => {
          this.busyKeys.delete(row.key);
          if (isReviewReportGone(err)) {
            this.toastr.info(this.translate.instant('d3.bookings.reviewReports.toast.alreadyHandled'));
            this.removeRow(row.key);
            return;
          }
          this.toastr.error(reviewReportErrorMessage(err) ?? this.translate.instant('d3.toast.errorOp'));
        },
      });
  }

  // ── Display helpers ────────────────────────────────────────────────────────
  fmt(n: number): string {
    return formatLocalizedNumber(n ?? 0, this.currentLang);
  }

  fmtRelative(iso: string | null | undefined): string {
    return iso ? relativeTime(iso, this.currentLang) : '—';
  }

  fmtDate(iso: string | null | undefined): string {
    return formatApiDateLocal(iso, this.currentLang, true) ?? '—';
  }

  trackRow(_index: number, row: ReviewReportRow): string {
    return row.key;
  }

  // ── Internals ──────────────────────────────────────────────────────────────
  private toRow(item: ReviewReportItem): ReviewReportRow {
    const reasons = (item.reasons ?? []).map(r => r?.trim()).filter((r): r is string => !!r);
    // Group identical reasons (case-insensitive), keeping first-seen order and wording.
    const groups = new Map<string, ReasonGroup>();
    for (const reason of reasons) {
      const k = reason.toLowerCase();
      const existing = groups.get(k);
      if (existing) existing.count++; else groups.set(k, { text: reason, count: 1 });
    }

    return {
      key: reviewReportKey(item),
      item,
      targetLabelKey: REVIEW_TARGET_FIELD_LABEL_KEY[item.targetField] ?? item.targetField,
      targetIcon: REVIEW_TARGET_FIELD_ICON[item.targetField] ?? 'message',
      reasonGroups: [...groups.values()].sort((a, b) => b.count - a.count),
      silentCount: Math.max(0, (item.reportCount ?? 0) - reasons.length),
    };
  }

  private removeRow(key: string): void {
    this.rows = this.rows.filter(r => r.key !== key);
    this.emitCount();
  }

  private emitCount(): void {
    this.countChange.emit({ total: this.rows.length, highPriority: this.highPriorityCount });
  }
}
