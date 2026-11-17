import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { appLocale } from 'src/app/utils/locale-format.util';
import {
  CancellationRefund, RESOLVE_NOTE_MAX_LENGTH, RESOLVE_REFERENCE_MAX_LENGTH,
} from '../cancellation-refund.model';
import { CancellationRefundsService } from '../cancellation-refunds.service';

export interface CancellationResolveDialogData {
  row: CancellationRefund;
  /** Localized currency label for the copy, e.g. "ر.س". */
  currencyLabel: string;
}

/** Errors that mean the row changed underneath us — the caller reloads the list. */
export const RESOLVE_STALE_CODES = new Set(['REFUND_NOT_IN_MANUAL_REVIEW', 'NOT_FOUND']);

export type CancellationResolveResult =
  | { kind: 'resolved'; row: CancellationRefund }
  | { kind: 'stale'; message: string };

/**
 * Closes a stalled refund that was paid back outside the system. Sends the request itself so a
 * rejected amount can be fixed in place. Closes with the result, or undefined when dismissed.
 */
@Component({
  selector: 'app-cancellation-resolve-dialog',
  standalone: true,
  imports: [FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './cancellation-resolve-dialog.component.html',
  styleUrl: '../../esim/esim-refund-dialog/esim-refund-dialog.component.scss'
})
export class CancellationResolveDialogComponent {
  private dialogRef = inject(MatDialogRef<CancellationResolveDialogComponent, CancellationResolveResult | undefined>);
  readonly data = inject<CancellationResolveDialogData>(MAT_DIALOG_DATA);
  private service = inject(CancellationRefundsService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly referenceMax = RESOLVE_REFERENCE_MAX_LENGTH;
  readonly noteMax = RESOLVE_NOTE_MAX_LENGTH;
  /** Prefilled with what the booking still owes the guest. */
  amount: number | string | null = this.data.row.amount > 0 ? this.data.row.amount : null;
  referenceNumber = '';
  note = '';
  submitting = false;
  submitted = false;
  serverError: string | null = null;

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get amountText(): string {
    return this.data.row.amount.toLocaleString(appLocale(this.translate.currentLang), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  private get parsedAmount(): number {
    return this.amount === null || this.amount === '' ? NaN : Number(this.amount);
  }

  /** Translation key of the amount's problem, or null when valid. */
  get amountError(): string | null {
    if (this.amount === null || this.amount === '') return 'd3.cancellationRefunds.resolveDialog.errors.amountRequired';
    const n = this.parsedAmount;
    if (!Number.isFinite(n) || n <= 0) return 'd3.cancellationRefunds.resolveDialog.errors.amountPositive';
    if (this.data.row.amount > 0 && n > this.data.row.amount) return 'd3.cancellationRefunds.resolveDialog.errors.amountAbove';
    return null;
  }

  submit(): void {
    this.submitted = true;
    if (this.submitting || this.amountError) return;
    this.submitting = true;
    this.serverError = null;
    const reference = this.referenceNumber.trim();
    const note = this.note.trim();
    this.service.markResolved(this.data.row.id, {
      refundedAmount: this.parsedAmount,
      ...(reference ? { referenceNumber: reference } : {}),
      ...(note ? { note } : {}),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: row => this.dialogRef.close({ kind: 'resolved', row }),
        error: (err: HttpErrorResponse) => {
          this.submitting = false;
          const code: string = err?.error?.errorCode ?? '';
          const message: string = (err?.error?.errors?.[0]?.message ?? err?.error?.message ?? '').trim();
          if (RESOLVE_STALE_CODES.has(code)) {
            this.dialogRef.close({
              kind: 'stale',
              message: message || this.translate.instant(code === 'NOT_FOUND'
                ? 'd3.cancellationRefunds.errors.notFound'
                : 'd3.cancellationRefunds.errors.notInManualReview'),
            });
            return;
          }
          this.serverError = this.errorText(err, message);
        },
      });
  }

  private errorText(err: HttpErrorResponse, message: string): string {
    // A timeout or dropped connection may still have closed the case — check before resending.
    if (!err?.status) return this.translate.instant('d3.cancellationRefunds.resolveDialog.errors.uncertain');
    if (err.status === 403) return this.translate.instant('d3.cancellationRefunds.errors.forbiddenResolve');
    // REFUND_RECORD_FAILED and validation errors carry their own explanation.
    if (message && err.status < 500) return message;
    return this.translate.instant(err.status >= 500 ? 'd3.cancellationRefunds.errors.network' : 'd3.toast.errorOp');
  }

  close(): void {
    if (!this.submitting) this.dialogRef.close(undefined);
  }
}
