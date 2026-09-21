import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { ToastrService } from 'ngx-toastr';
import { filter } from 'rxjs';
import { resolveWalletError } from '../../interfaces/wallet-error.util';
import { WalletService } from '../../services/wallet.service';

export interface WalletAdjustDialogData {
  merchantAccountId: string;
  currentBalance: number;
  currencyIconSrc: string;
  isTextCurrency: boolean;
}

/** `undefined` = cancelled without an adjustment being recorded. */
export type WalletAdjustDialogResult = { newBalance: number } | undefined;

type DialogStep = 'form' | 'confirm' | 'success';
type AdjustDirection = 'credit' | 'debit';

const REASON_MAX = 2000;
const round2 = (value: number): number => Math.round(value * 100) / 100;

@Component({
  selector: 'app-wallet-adjust-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule, TablerIconsModule],
  templateUrl: './wallet-adjust-dialog.component.html',
  styleUrl: './wallet-adjust-dialog.component.scss'
})
export class WalletAdjustDialogComponent {
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private service = inject(WalletService);

  readonly reasonMax = REASON_MAX;

  step: DialogStep = 'form';
  submitting = false;

  direction: AdjustDirection = 'credit';
  amount: number | null = null;
  reason = '';

  newBalance = 0;

  constructor(
    public dialogRef: MatDialogRef<WalletAdjustDialogComponent, WalletAdjustDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: WalletAdjustDialogData
  ) {
    // There's no server-side undo for an adjustment, so dismissing by backdrop/Esc
    // is only ever a cancel before submit — never a way to skip past a recorded result.
    dialogRef.disableClose = true;
    dialogRef.backdropClick().subscribe(() => this.close());
    dialogRef.keydownEvents().pipe(filter(e => e.key === 'Escape')).subscribe(() => this.close());
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  setDirection(direction: AdjustDirection): void {
    if (this.submitting) return;
    this.direction = direction;
  }

  get exceedsBalance(): boolean {
    return this.direction === 'debit' && this.amount !== null && round2(this.amount) > round2(this.data.currentBalance);
  }

  get canContinue(): boolean {
    const reason = this.reason.trim();
    return this.amount !== null && this.amount > 0 && !this.exceedsBalance
      && !!reason && reason.length <= REASON_MAX;
  }

  get signedAmount(): number {
    const amount = round2(this.amount ?? 0);
    return this.direction === 'debit' ? -amount : amount;
  }

  get estimatedNewBalance(): number {
    return round2(this.data.currentBalance + this.signedAmount);
  }

  goToConfirm(): void {
    if (!this.canContinue) return;
    this.step = 'confirm';
  }

  backToForm(): void {
    this.step = 'form';
  }

  fmt(value: number): string {
    return value.toLocaleString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  confirm(): void {
    if (this.submitting) return;
    this.submitting = true;
    this.service.adjust(this.data.merchantAccountId, {
      amount: this.signedAmount,
      reason: this.reason.trim(),
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
