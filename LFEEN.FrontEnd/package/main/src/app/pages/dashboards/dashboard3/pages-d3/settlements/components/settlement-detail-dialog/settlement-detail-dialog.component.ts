import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { ToastrService } from 'ngx-toastr';
import { filter } from 'rxjs';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import { RECEIPT_ALLOWED_TYPES, RECEIPT_MAX_BYTES, SettlementActionResult } from '../../interfaces/settlement.model';
import { isStaleStateError, resolveSettlementError } from '../../interfaces/settlement-error.util';
import { SettlementsService } from '../../services/settlements.service';

export interface SettlementDetailDialogData {
  id: string;
  netAmount: number;
  /** Execute permission AND a status the backend accepts execute/fail on. */
  canExecute: boolean;
  accountName: string;
  hostName: string;
  phone: string;
  amountFormatted: string;
  currencyIconSrc: string;
  isTextCurrency: boolean;
  bankAccountHolder: string;
  bankName: string;
  bankAccountNumber: string;
  iban: string;
  hasIban: boolean;
  bankVerified: boolean;
}

/** `refresh` = the payout is no longer in the state we opened it in — reload the list. */
export type SettlementDialogResult =
  | { decision: 'approved' }
  | { decision: 'rejected'; reason: string }
  | { decision: 'refresh' }
  | undefined;

type DialogStep = 'details' | 'confirmTransfer' | 'success' | 'confirmReject' | 'rejectSuccess';

const TRX_REFERENCE_MAX = 200;
const REJECT_REASON_MAX = 2000;
const EMPTY = '-';

const round2 = (value: number): number => Math.round(value * 100) / 100;

@Component({
  selector: 'app-settlement-detail-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule, TablerIconsModule],
  templateUrl: './settlement-detail-dialog.component.html',
  styleUrl: './settlement-detail-dialog.component.scss'
})
export class SettlementDetailDialogComponent {
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private service = inject(SettlementsService);

  readonly emptyValue = EMPTY;
  readonly trxReferenceMax = TRX_REFERENCE_MAX;
  readonly rejectReasonMax = REJECT_REASON_MAX;

  step: DialogStep = 'details';
  submitting = false;

  // ── Transfer confirmation step ─────────────────────────────
  actualAmount: number | null = null;
  trxId = '';
  partialReason = '';
  receiptFile: File | null = null;
  isDragging = false;

  // ── Success step ────────────────────────────────────────────
  trxNumber = '';
  transferredAmount = 0;
  executionTime: Date | null = null;
  receiptUploadFailed = false;
  receiptRetrying = false;

  // ── Reject confirmation step ───────────────────────────────
  rejectReason = '';
  rejectionTime: Date | null = null;

  constructor(
    public dialogRef: MatDialogRef<SettlementDetailDialogComponent, SettlementDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: SettlementDetailDialogData
  ) {
    this.actualAmount = data.netAmount;

    // Once the backend has recorded a result, dismissing by backdrop/Esc must still
    // hand that result back, so the list reloads instead of showing a stale row.
    dialogRef.disableClose = true;
    dialogRef.backdropClick().subscribe(() => this.close());
    dialogRef.keydownEvents().pipe(filter(e => e.key === 'Escape')).subscribe(() => this.close());
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get isDetailsStep(): boolean {
    return this.step === 'details';
  }

  get headerIconName(): string {
    switch (this.step) {
      case 'confirmTransfer': return 'circle-check';
      case 'confirmReject':   return 'circle-x';
      case 'rejectSuccess':   return 'circle-check';
      default:                return 'eye';
    }
  }

  get headerTitleKey(): string {
    switch (this.step) {
      case 'confirmTransfer': return 'd3.settlements.detail.confirmTransferTitle';
      case 'confirmReject':   return 'd3.settlements.detail.confirmRejectTitle';
      case 'rejectSuccess':   return 'd3.settlements.detail.rejectSuccessTitle';
      default:                return 'd3.settlements.detail.title';
    }
  }

  get headerSubtitleKey(): string | null {
    if (this.step === 'details') return 'd3.settlements.detail.subtitle';
    if (this.step === 'rejectSuccess') return 'd3.settlements.detail.rejectSuccessSubtitle';
    return null;
  }

  get headerBadgeVariant(): 'success' | 'danger' | 'default' {
    if (this.step === 'confirmTransfer') return 'success';
    if (this.step === 'confirmReject' || this.step === 'rejectSuccess') return 'danger';
    return 'default';
  }

  goToConfirmTransfer(): void {
    this.step = 'confirmTransfer';
  }

  goToConfirmReject(): void {
    this.step = 'confirmReject';
  }

  // ── Reject ──────────────────────────────────────────────────

  get canConfirmReject(): boolean {
    const reason = this.rejectReason.trim();
    return !this.submitting && !!reason && reason.length <= REJECT_REASON_MAX;
  }

  confirmReject(): void {
    if (!this.canConfirmReject) return;
    this.submitting = true;
    this.service.fail(this.data.id, this.rejectReason.trim()).subscribe({
      next: res => {
        // The reason itself is shown from what the admin typed: the fail response returns `notes: null`.
        this.rejectionTime = parseApiUtc(res.lastActionAtUtc) ?? new Date();
        this.submitting = false;
        this.step = 'rejectSuccess';
      },
      error: err => this.handleActionError(err),
    });
  }

  get rejectionTimeLabel(): string {
    if (!this.rejectionTime) return EMPTY;
    const locale = this.translate.currentLang === 'en' ? enUS : ar;
    const date = format(this.rejectionTime, 'd MMMM yyyy', { locale });
    const time = format(this.rejectionTime, 'hh:mm a', { locale });
    return `${date} • ${time}`;
  }

  finishReject(): void {
    this.dialogRef.close({ decision: 'rejected', reason: this.rejectReason.trim() });
  }

  // Backdrop/Esc/X all funnel here — a step that already recorded a result must
  // close with that result, never as a plain cancel.
  close(): void {
    if (this.submitting) return;
    if (this.step === 'success') return this.finish();
    if (this.step === 'rejectSuccess') return this.finishReject();
    this.dialogRef.close(undefined);
  }

  copyIban(): void {
    if (!this.data.hasIban) return;
    navigator.clipboard?.writeText(this.data.iban).then(() => {
      this.toastr.success(this.translate.instant('d3.settlements.detail.ibanCopied'));
    });
  }

  // ── Receipt file ────────────────────────────────────────────

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.acceptFile(input.files[0]);
    }
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.acceptFile(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(): void {
    this.isDragging = false;
  }

  removeFile(event: Event): void {
    event.stopPropagation();
    this.receiptFile = null;
  }

  // The backend doesn't validate the receipt's type or size, so this is the only gate.
  private acceptFile(file: File): void {
    if (!RECEIPT_ALLOWED_TYPES.includes(file.type)) {
      this.toastr.error(this.translate.instant('d3.settlements.errors.receiptType'));
      return;
    }
    if (file.size > RECEIPT_MAX_BYTES) {
      this.toastr.error(this.translate.instant('d3.settlements.errors.receiptSize'));
      return;
    }
    this.receiptFile = file;
  }

  // ── Execute ─────────────────────────────────────────────────

  get amountExceedsNet(): boolean {
    return this.actualAmount !== null && round2(this.actualAmount) > round2(this.data.netAmount);
  }

  /** A transfer below the requested amount is a partial settlement and needs a reason. */
  get isPartialTransfer(): boolean {
    return this.actualAmount !== null
      && this.actualAmount > 0
      && round2(this.actualAmount) < round2(this.data.netAmount);
  }

  get canConfirmTransfer(): boolean {
    const amount = this.actualAmount;
    const trx = this.trxId.trim();
    return !this.submitting
      && amount !== null && amount > 0 && !this.amountExceedsNet
      && !!trx && trx.length <= TRX_REFERENCE_MAX
      && (!this.isPartialTransfer || !!this.partialReason.trim())
      && !!this.receiptFile;
  }

  confirmTransfer(): void {
    if (!this.canConfirmTransfer || this.actualAmount === null) return;
    this.submitting = true;

    this.service.execute(this.data.id, {
      bankTransferReference: this.trxId.trim(),
      transferredAmount: round2(this.actualAmount),
      ...(this.isPartialTransfer ? { partialReason: this.partialReason.trim() } : {}),
    }).subscribe({
      next: res => {
        this.applyExecutionResult(res);
        // The execution is already recorded at this point — a receipt failure must
        // never re-run execute, it only offers a receipt re-upload on the success step.
        this.uploadReceipt(() => {
          this.submitting = false;
          this.step = 'success';
        });
      },
      error: err => this.handleActionError(err),
    });
  }

  retryReceiptUpload(): void {
    if (this.receiptRetrying) return;
    this.receiptRetrying = true;
    this.uploadReceipt(() => { this.receiptRetrying = false; });
  }

  private applyExecutionResult(res: SettlementActionResult): void {
    this.trxNumber = res.bankTransferReference?.trim() || this.trxId.trim();
    // A full transfer comes back with transferredAmount = null.
    this.transferredAmount = res.transferredAmount ?? this.data.netAmount;
    this.executionTime = parseApiUtc(res.completedAtUtc) ?? parseApiUtc(res.lastActionAtUtc);
  }

  private uploadReceipt(done: () => void): void {
    if (!this.receiptFile) { done(); return; }
    this.service.uploadReceipt(this.data.id, this.receiptFile).subscribe({
      next: () => {
        this.receiptUploadFailed = false;
        done();
      },
      error: err => {
        this.receiptUploadFailed = true;
        this.toastr.error(
          `${this.translate.instant('d3.settlements.errors.receiptUploadFailed')} ${resolveSettlementError(err, this.translate)}`
        );
        done();
      },
    });
  }

  private handleActionError(err: unknown): void {
    this.submitting = false;
    this.toastr.error(resolveSettlementError(err, this.translate));
    // 409 means the payout already left Pending/Processing — nothing here can succeed anymore.
    if (isStaleStateError(err)) {
      this.dialogRef.close({ decision: 'refresh' });
    }
  }

  get formattedTransferredAmount(): string {
    return this.transferredAmount.toLocaleString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  get executionTimeLabel(): string {
    if (!this.executionTime) return EMPTY;
    const locale = this.translate.currentLang === 'en' ? enUS : ar;
    const time = format(this.executionTime, 'hh:mm a', { locale });
    return this.translate.instant('d3.settlements.detail.now', { time });
  }

  finish(): void {
    this.dialogRef.close({ decision: 'approved' });
  }
}
