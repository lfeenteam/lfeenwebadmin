import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { appLocale } from 'src/app/utils/locale-format.util';
import { ESIM_REFUND_REASON_MAX_LENGTH, EsimOrder } from '../interfaces/esim.model';
import { resolveEsimError } from '../interfaces/esim-error.util';
import { EsimService } from '../services/esim.service';

export interface EsimRefundDialogData {
  orderId: string;
  packageName: string;
  totalSar: number;
  refundedSar: number;
  /** The most this refund may be (refundableRemainingSar). */
  remainingSar: number;
}

/**
 * refunded = done; refresh = the order changed while the dialog was open (another refund ran,
 * or the backend says it can't be refunded any more), so the caller should re-fetch.
 */
export type EsimRefundResult = { kind: 'refunded'; order: EsimOrder } | { kind: 'refresh' };

/** Codes that mean our numbers are out of date. */
const STALE_CODES = new Set(['ESIM_REFUND_IN_PROGRESS', 'ESIM_ORDER_NOT_REFUNDABLE', 'ESIM_REFUND_TOO_LARGE']);

/**
 * Refunds an eSIM order in full (amount left empty) or in part. Sends the request itself so a
 * rejected amount can be fixed without reopening.
 */
@Component({
  selector: 'app-esim-refund-dialog',
  standalone: true,
  imports: [FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './esim-refund-dialog.component.html',
  styleUrl: './esim-refund-dialog.component.scss'
})
export class EsimRefundDialogComponent {
  private dialogRef = inject(MatDialogRef<EsimRefundDialogComponent, EsimRefundResult | undefined>);
  readonly data = inject<EsimRefundDialogData>(MAT_DIALOG_DATA);
  private service = inject(EsimService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly maxLength = ESIM_REFUND_REASON_MAX_LENGTH;
  /** Bound to a number input: null/'' when empty. */
  amount: number | string | null = null;
  reason = '';
  submitting = false;
  submitted = false;
  serverError: string | null = null;
  /** The backend reported the order changed — tell the caller to re-fetch on close. */
  private stale = false;

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  fmt(value: number): string {
    return (value ?? 0).toLocaleString(appLocale(this.translate.currentLang), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }

  private get parsedAmount(): number | null {
    if (this.amount === null || this.amount === '') return null;
    const n = Number(this.amount);
    return Number.isFinite(n) ? n : NaN;
  }

  /** Translation key of the amount's problem, or null when valid. */
  get amountError(): string | null {
    const n = this.parsedAmount;
    if (n === null) return null;
    if (Number.isNaN(n) || n <= 0) return 'd3.esim.refund.errors.amountPositive';
    if (n > this.data.remainingSar) return 'd3.esim.refund.errors.amountAboveRemaining';
    return null;
  }

  get reasonError(): string | null {
    return this.reason.trim() ? null : 'd3.esim.refund.errors.reasonRequired';
  }

  submit(): void {
    this.submitted = true;
    if (this.submitting || this.amountError || this.reasonError) return;
    this.submitting = true;
    this.serverError = null;
    this.service.refundOrder(this.data.orderId, { amount: this.parsedAmount, reason: this.reason.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: order => this.dialogRef.close({ kind: 'refunded', order }),
        error: (err: HttpErrorResponse) => {
          this.submitting = false;
          if (STALE_CODES.has(err?.error?.errorCode ?? '')) this.stale = true;
          // A timeout or dropped connection may still have refunded — don't invite a blind resend.
          this.serverError = !err?.status
            ? this.translate.instant('d3.esim.refund.errors.uncertain')
            : resolveEsimError(err, this.translate, 'orderNotFound');
          if (!err?.status) this.stale = true;
        },
      });
  }

  close(): void {
    if (this.submitting) return;
    this.dialogRef.close(this.stale ? { kind: 'refresh' } : undefined);
  }
}
