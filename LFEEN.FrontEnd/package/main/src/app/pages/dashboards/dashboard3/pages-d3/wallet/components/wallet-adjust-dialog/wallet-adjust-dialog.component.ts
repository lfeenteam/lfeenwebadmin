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
import { parseApiUtc } from 'src/app/utils/date-format.util';
import {
  CATEGORIES_REQUIRING_REASON,
  CATEGORY_FORCED_DIRECTION,
  WALLET_MAX_ATTACHMENTS,
  WalletCategory,
  WalletCategoryValue,
  WalletDirection,
} from '../../interfaces/wallet.model';
import { resolveWalletError } from '../../interfaces/wallet-error.util';
import { WalletService } from '../../services/wallet.service';
import { WalletFilePickerComponent } from '../wallet-file-picker/wallet-file-picker.component';

export interface WalletAdjustDialogData {
  merchantAccountId: string;
  currentBalance: number;
  currencyIconSrc: string;
  isTextCurrency: boolean;
  categories: WalletCategory[];
  /** Set when correcting an existing manual entry instead of making a fresh adjustment. */
  correction?: { entryId: string; signedAmount: number; createdAtUtc: string };
}

/** `undefined` = cancelled without an adjustment being recorded. */
export type WalletAdjustDialogResult = { newBalance: number } | undefined;

type DialogStep = 'form' | 'confirm' | 'success';

const REASON_MAX = 2000;
const round2 = (value: number): number => Math.round(value * 100) / 100;

@Component({
  selector: 'app-wallet-adjust-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule, TablerIconsModule, WalletFilePickerComponent],
  templateUrl: './wallet-adjust-dialog.component.html',
  styleUrl: './wallet-adjust-dialog.component.scss'
})
export class WalletAdjustDialogComponent {
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private service = inject(WalletService);

  readonly reasonMax = REASON_MAX;
  readonly maxFiles = WALLET_MAX_ATTACHMENTS;

  step: DialogStep = 'form';
  submitting = false;

  direction: WalletDirection = 'Credit';
  category: WalletCategoryValue | null = null;
  amount: number | null = null;
  reason = '';
  files: File[] = [];
  /** Correction mode only: the original entry shouldn't have been made at all (correct amount = 0). */
  shouldNotExist = false;

  newBalance = 0;

  constructor(
    public dialogRef: MatDialogRef<WalletAdjustDialogComponent, WalletAdjustDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: WalletAdjustDialogData
  ) {
    if (data.correction) {
      this.category = 'Correction';
      const date = parseApiUtc(data.correction.createdAtUtc);
      this.reason = this.translate.instant('d3.wallet.correct.reasonTemplate', {
        id: data.correction.entryId.slice(0, 8),
        date: date ? format(date, 'dd/MM/yyyy') : '-',
      });
    }

    // There's no server-side undo for an adjustment, so dismissing by backdrop/Esc
    // is only ever a cancel before submit — never a way to skip past a recorded result.
    dialogRef.disableClose = true;
    dialogRef.backdropClick().subscribe(() => this.close());
    dialogRef.keydownEvents().pipe(filter(e => e.key === 'Escape')).subscribe(() => this.close());
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get isCorrection(): boolean {
    return !!this.data.correction;
  }

  get isCredit(): boolean {
    return this.signedAmount > 0;
  }

  categoryLabel(c: WalletCategory): string {
    return this.translate.currentLang === 'en' ? c.nameEn : c.nameAr;
  }

  get categoryHintKey(): string | null {
    return this.category ? `d3.wallet.categoryHints.${this.category}` : null;
  }

  /** A category that dictates the sign locks the toggle; Correction/Other leave it free. */
  get forcedDirection(): WalletDirection | undefined {
    return this.category && !this.isCorrection ? CATEGORY_FORCED_DIRECTION[this.category] : undefined;
  }

  onCategoryChange(): void {
    if (this.forcedDirection) this.direction = this.forcedDirection;
  }

  setDirection(direction: WalletDirection): void {
    if (this.submitting || this.forcedDirection) return;
    this.direction = direction;
  }

  get reasonRequired(): boolean {
    return !!this.category && CATEGORIES_REQUIRING_REASON.includes(this.category);
  }

  /** Signed amount of the original entry (correction mode). */
  get originalSigned(): number {
    return this.data.correction?.signedAmount ?? 0;
  }

  /** What the admin typed, with the sign from the toggle. In correction mode: the amount the entry should have had. */
  private get typedSigned(): number {
    const magnitude = round2(this.amount ?? 0);
    return this.direction === 'Debit' ? -magnitude : magnitude;
  }

  /** The signed amount actually sent to the API. */
  get signedAmount(): number {
    if (!this.isCorrection) return this.typedSigned;
    const correct = this.shouldNotExist ? 0 : this.typedSigned;
    return round2(correct - this.originalSigned);
  }

  get hasAmountInput(): boolean {
    return this.isCorrection ? (this.shouldNotExist || (this.amount ?? 0) > 0) : (this.amount ?? 0) > 0;
  }

  /** Correction mode: the typed "correct amount" equals what's already recorded. */
  get noChangeNeeded(): boolean {
    return this.isCorrection && this.hasAmountInput && this.signedAmount === 0;
  }

  get exceedsBalance(): boolean {
    return this.signedAmount < 0 && round2(-this.signedAmount) > round2(this.data.currentBalance);
  }

  get canContinue(): boolean {
    const reason = this.reason.trim();
    return !this.submitting
      && !!this.category
      && this.hasAmountInput
      && this.signedAmount !== 0
      && !this.exceedsBalance
      && reason.length <= REASON_MAX
      && (!this.reasonRequired || !!reason);
  }

  get estimatedNewBalance(): number {
    return round2(this.data.currentBalance + this.signedAmount);
  }

  goToConfirm(): void {
    if (!this.canContinue) return;
    this.step = 'confirm';
  }

  backToForm(): void {
    if (this.submitting) return;
    this.step = 'form';
  }

  fmt(value: number): string {
    return Math.abs(value).toLocaleString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  get selectedCategoryLabel(): string {
    const c = this.data.categories.find(x => x.value === this.category);
    return c ? this.categoryLabel(c) : '';
  }

  // Never auto-retried: if the request is cut off, the admin re-checks the ledger first,
  // otherwise the same adjustment could be applied twice.
  confirm(): void {
    if (this.submitting || !this.category || this.signedAmount === 0) return;
    this.submitting = true;
    this.service.adjust(this.data.merchantAccountId, {
      amount: this.signedAmount,
      category: this.category,
      reason: this.reason.trim() || undefined,
      files: this.files,
    }).subscribe({
      next: res => {
        this.newBalance = res.newBalance;
        this.submitting = false;
        this.step = 'success';
      },
      error: err => {
        this.submitting = false;
        this.toastr.error(resolveWalletError(err, this.translate));
        this.step = 'form';
      },
    });
  }

  close(): void {
    if (this.submitting) return;
    if (this.step === 'success') return this.finish();
    this.dialogRef.close(undefined);
  }

  finish(): void {
    this.dialogRef.close({ newBalance: this.newBalance });
  }
}
