import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { ToastrService } from 'ngx-toastr';
import { filter } from 'rxjs';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import { RECEIPT_ALLOWED_TYPES, RECEIPT_MAX_BYTES, RecalculationState, SettlementActionResult, recalculationStateOf } from '../../interfaces/settlement.model';
import { isIbanMismatchError, isReceiptRequiredError, isStaleStateError, PayoutBlock, payoutBlockOf, resolveSettlementError } from '../../interfaces/settlement-error.util';
import { rawBlockerTexts } from '../../interfaces/settlement-labels.util';
import { SettlementsService } from '../../services/settlements.service';
import { appLocale } from 'src/app/utils/locale-format.util';
import { RecalculationDialogComponent, RecalculationDialogData, RecalculationDialogResult } from '../recalculation-dialog/recalculation-dialog.component';

export interface SettlementDetailDialogData {
  id: string;
  /** Merchant account — used to open the debts list filtered on this merchant. */
  accountId: string;
  netAmount: number;
  /**
   * Listed by GET recalculation-preview (BUG-1482). The dialog runs the dry run itself to
   * tell "recalculate first" from "on hold" from "nothing to do".
   */
  needsRecalculation: boolean;
  /** Execute permission AND a status the backend accepts execute/fail on. */
  canExecute: boolean;
  /** Execute permission AND a not-yet-transferred status (Pending / Failed / OnHold) — may be recalculated. */
  canRecalculate: boolean;
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
  /** Raw bank.iban, sent back as confirmedIban — `iban` above is trimmed and may be the "-" placeholder. */
  confirmedIban: string;
  /** Execute is blocked without one: the backend fails the payout outright instead of rejecting the request. */
  hasIban: boolean;
  swiftCode: string;
  bankVerified: boolean;
  payoutReference: string;
  requestDateLabel: string;
  periodLabel: string;
  grossFormatted: string;
  feeFormatted: string;
  entries: SettlementDetailDialogEntry[];

  // ── Status / execution (read from GET /api/settlements/{id}) ──
  /** Translation key of the status chip; null = unknown status, `statusLabel` (raw) is shown. */
  statusKey: string | null;
  statusLabel: string;
  statusClass: string;
  /** Completed / PartiallyCompleted — the transfer happened, show what was actually sent. */
  isExecuted: boolean;
  isPartial: boolean;
  /** transferredAmount, or netAmount for a full transfer (the backend sends null then). */
  transferredFormatted: string;
  /** netAmount − transferred; only meaningful on a partial transfer. */
  remainingFormatted: string;
  partialReason: string;
  bankTransferReference: string;
  processedAtLabel: string;
  processedBy: string;
  receiptUrl: string | null;
  /** Failed payouts: the reason the admin recorded. */
  rejectionReason: string | null;
  /** The leftover payout created by a partial transfer (originatingPayoutId set). */
  isRemainder: boolean;
  /** payoutReference of the original payout, when it's in the loaded list; '' otherwise. */
  originatingReference: string;
}

/** One booking payment covered by the payout — amounts are pre-formatted by the opener. */
export interface SettlementDetailDialogEntry {
  bookingNumber: string;
  gross: string;
  fee: string;
  net: string;
  /** Refunded after its payout was settled — highlighted and tagged. */
  isRefundAfterSettlement: boolean;
}

/**
 * `refresh` = the payout is no longer in the state we opened it in — reload the list.
 * `recalculated` = its totals changed — reload the list and reopen the payout with the new figures.
 */
export type SettlementDialogResult =
  | { decision: 'approved' }
  | { decision: 'rejected'; reason: string }
  | { decision: 'refresh' }
  | { decision: 'recalculated' }
  | undefined;

type DialogStep = 'details' | 'confirmTransfer' | 'success' | 'confirmReject' | 'rejectSuccess';

const TRX_REFERENCE_MAX = 200;
const REJECT_REASON_MAX = 2000;
const EMPTY = '-';
const NARROW_WIDTH = '480px';

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
  private dialog = inject(MatDialog);
  private router = inject(Router);

  readonly emptyValue = EMPTY;

  /** Execute was refused by a BUG-1482 rule — shown with its server text and the matching action. */
  block: PayoutBlock | null = null;
  recalcOpen = false;

  /** Dry-run verdict for a payout listed by recalculation-preview; null = not listed / not checked yet. */
  recalcState: RecalculationState | null = null;
  /** The core's raw (technical, English) blocker texts — shown only under a collapsed "Details". */
  holdReasons: string[] = [];
  checkingRecalc = false;
  readonly trxReferenceMax = TRX_REFERENCE_MAX;
  readonly rejectReasonMax = REJECT_REASON_MAX;

  step: DialogStep = 'details';
  submitting = false;
  /** Why the last execute/reject attempt failed — shown inside the dialog, not just as a passing toast. */
  actionError: string | null = null;

  // ── Transfer confirmation step ─────────────────────────────
  actualAmount: number | null = null;
  trxId = '';
  partialReason = '';
  receiptFile: File | null = null;
  /** The file the backend already holds for this payout — a retried execute doesn't upload it again. */
  private uploadedReceipt: File | null = null;
  isDragging = false;
  // The host changed their IBAN after this dialog was opened. The money was most likely
  // already sent to the old one, so this needs a person to check — never a silent retry
  // against the new IBAN, which would record a transfer that didn't happen.
  ibanMismatch = false;

  // ── Success step ────────────────────────────────────────────
  trxNumber = '';
  transferredAmount = 0;
  executionTime: Date | null = null;

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

    if (data.needsRecalculation && (data.canExecute || data.canRecalculate)) this.checkRecalculation();
  }

  /**
   * Being listed by recalculation-preview isn't enough to say "recalculate first": a payout
   * with no changes and a blocker (a refund under manual review) can't be recalculated at all.
   * The dry run saves nothing, so it's safe to run on every open.
   */
  private checkRecalculation(): void {
    this.checkingRecalc = true;
    this.service.getRecalculation(this.data.id).subscribe({
      next: res => {
        this.checkingRecalc = false;
        this.recalcState = recalculationStateOf(res);
        this.holdReasons = rawBlockerTexts(res.blockers);
      },
      // Can't tell — keep the safe default; a refused execute still explains itself.
      error: () => {
        this.checkingRecalc = false;
        this.recalcState = 'needed';
      },
    });
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

  // Only the details step uses the wide two-column layout — the rest are narrow forms.
  goToConfirmTransfer(): void {
    this.actionError = null;
    this.step = 'confirmTransfer';
    this.dialogRef.updateSize(NARROW_WIDTH);
  }

  goToConfirmReject(): void {
    this.actionError = null;
    this.step = 'confirmReject';
    this.dialogRef.updateSize(NARROW_WIDTH);
  }

  // ── Reject ──────────────────────────────────────────────────

  get canConfirmReject(): boolean {
    const reason = this.rejectReason.trim();
    return !this.submitting && !!reason && reason.length <= REJECT_REASON_MAX;
  }

  confirmReject(): void {
    if (!this.canConfirmReject) return;
    this.submitting = true;
    this.actionError = null;
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
    // The bank details on the list are stale now — reload so a reopen shows the new IBAN.
    if (this.ibanMismatch) return this.dialogRef.close({ decision: 'refresh' });
    // A refused execute may mean the list's "needs recalculation" badges are out of date.
    if (this.block) return this.dialogRef.close({ decision: 'refresh' });
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
    this.uploadedReceipt = null;
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
    // A new file must reach the backend before the next execute.
    this.uploadedReceipt = null;
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
      && this.data.hasIban && !this.ibanMismatch
      // A refund in progress clears by itself, so trying again later is allowed; the other blocks need action first.
      && !this.mustRecalculate && !this.isOnHold && !this.checkingRecalc
      && (!this.block || this.block.kind === 'refundInProgress')
      && amount !== null && amount > 0 && !this.amountExceedsNet
      && !!trx && trx.length <= TRX_REFERENCE_MAX
      && (!this.isPartialTransfer || !!this.partialReason.trim())
      && !!this.receiptFile;
  }

  /**
   * The backend refuses execute (400 RECEIPT_REQUIRED) until a receipt is on file, so the
   * receipt goes first and execute only runs once it's stored. A failed upload stops here:
   * nothing was executed and the admin can simply try again.
   */
  confirmTransfer(): void {
    if (!this.canConfirmTransfer || !this.receiptFile) return;
    this.submitting = true;
    this.block = null;
    this.actionError = null;

    const file = this.receiptFile;
    if (this.uploadedReceipt === file) {
      this.executeTransfer();
      return;
    }

    this.service.uploadReceipt(this.data.id, file).subscribe({
      next: () => {
        this.uploadedReceipt = file;
        this.executeTransfer();
      },
      error: err => {
        this.submitting = false;
        this.actionError = `${this.translate.instant('d3.settlements.errors.receiptUploadFailed')} ${resolveSettlementError(err, this.translate)}`;
        // The payout may have moved on meanwhile — same handling as a stale execute.
        if (isStaleStateError(err)) this.dialogRef.close({ decision: 'refresh' });
      },
    });
  }

  private executeTransfer(): void {
    if (this.actualAmount === null) return;
    this.service.execute(this.data.id, {
      bankTransferReference: this.trxId.trim(),
      confirmedIban: this.data.confirmedIban,
      transferredAmount: round2(this.actualAmount),
      ...(this.isPartialTransfer ? { partialReason: this.partialReason.trim() } : {}),
    }).subscribe({
      next: res => {
        this.applyExecutionResult(res);
        this.submitting = false;
        this.step = 'success';
      },
      error: err => {
        // The backend doesn't hold the receipt after all — the next attempt uploads it again.
        if (isReceiptRequiredError(err)) this.uploadedReceipt = null;
        this.handleActionError(err);
      },
    });
  }

  private applyExecutionResult(res: SettlementActionResult): void {
    this.trxNumber = res.bankTransferReference?.trim() || this.trxId.trim();
    // A full transfer comes back with transferredAmount = null.
    this.transferredAmount = res.transferredAmount ?? this.data.netAmount;
    this.executionTime = parseApiUtc(res.completedAtUtc) ?? parseApiUtc(res.lastActionAtUtc);
  }

  private handleActionError(err: unknown): void {
    this.submitting = false;
    // A BUG-1482 block: nothing was executed. Keep the dialog open with the server's reason
    // and the way forward (recalculate / debts list) instead of a toast that disappears.
    const block = payoutBlockOf(err);
    if (block) {
      this.block = block;
      return;
    }
    // IBAN mismatch: keep the dialog (and what the admin typed) open, with confirm locked —
    // resending the same IBAN can only 409 again. It has its own alert in the dialog.
    if (isIbanMismatchError(err)) {
      this.toastr.error(resolveSettlementError(err, this.translate));
      this.ibanMismatch = true;
      return;
    }
    // Any other 409 means the payout already left Pending/Processing — nothing here can succeed anymore.
    if (isStaleStateError(err)) {
      this.toastr.error(resolveSettlementError(err, this.translate));
      this.dialogRef.close({ decision: 'refresh' });
      return;
    }
    // Anything else (RECEIPT_REQUIRED, validation, network…): the dialog stays open with what
    // the admin typed, so the reason has to stay visible inside it.
    this.actionError = resolveSettlementError(err, this.translate);
  }

  get formattedTransferredAmount(): string {
    return this.transferredAmount.toLocaleString(appLocale(this.translate.currentLang), {
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

  // ── Recalculation / debts (BUG-1482) ───────────────────────

  /** Execute can't succeed until the payout is recalculated — known from the dry run or learned from a refused execute. */
  get mustRecalculate(): boolean {
    return this.recalcState === 'needed' || this.block?.kind === 'needsRecalculation';
  }

  /** Nothing to recalculate but something holds the payout — wait, recalculating won't help. */
  get isOnHold(): boolean {
    return this.recalcState === 'onHold' && !this.block;
  }

  /** Offered alongside a debt block too: recalculating may net the debt off this payout. */
  get canOfferRecalculation(): boolean {
    return this.mustRecalculate || this.block?.kind === 'debtOutstanding';
  }

  get blockMessage(): string {
    if (this.block) return this.block.message || this.translate.instant(`d3.settlements.errors.block.${this.block.kind}`);
    return this.translate.instant('d3.settlements.errors.block.needsRecalculation');
  }

  openRecalculation(): void {
    if (this.recalcOpen || this.submitting) return;
    this.recalcOpen = true;
    this.dialog.open<RecalculationDialogComponent, RecalculationDialogData, RecalculationDialogResult>(RecalculationDialogComponent, {
      width: '560px',
      maxWidth: '92vw',
      maxHeight: '92vh',
      data: {
        id: this.data.id,
        payoutReference: this.data.payoutReference,
        accountName: this.data.accountName,
        currencyIconSrc: this.data.currencyIconSrc,
        isTextCurrency: this.data.isTextCurrency,
      },
    }).afterClosed().subscribe(result => {
      this.recalcOpen = false;
      // The amount, entries and the confirmed figures here are all stale now — reopen fresh.
      if (result?.applied) this.dialogRef.close({ decision: 'recalculated' });
    });
  }

  /** Opens the Settlements "Merchant debts" tab, filtered on this merchant. */
  openDebts(): void {
    const lang = this.router.url.split('/')[1] || 'ar';
    this.dialogRef.close(this.block ? { decision: 'refresh' } : undefined);
    this.router.navigate(['/', lang, 'd3', 'settlements'], { queryParams: { tab: 'debts', accountId: this.data.accountId } });
  }
}
