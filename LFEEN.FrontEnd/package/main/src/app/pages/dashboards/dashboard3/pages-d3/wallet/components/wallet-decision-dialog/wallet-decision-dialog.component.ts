import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

export interface WalletDecisionDialogData {
  mode: 'approve' | 'reject';
  /** Already formatted, signed (e.g. "+50,000.00"). */
  amountText: string;
  isCredit: boolean;
  merchantLabel: string;
  requestedBy: string | null;
}

/** `undefined` = cancelled. For a rejection, `reason` is what the admin typed (may be empty). */
export type WalletDecisionDialogResult = { reason: string } | undefined;

const REASON_MAX = 500;

@Component({
  selector: 'app-wallet-decision-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule, TablerIconsModule],
  templateUrl: './wallet-decision-dialog.component.html',
  styleUrl: './wallet-decision-dialog.component.scss'
})
export class WalletDecisionDialogComponent {
  private translate = inject(TranslateService);

  readonly reasonMax = REASON_MAX;
  reason = '';

  constructor(
    public dialogRef: MatDialogRef<WalletDecisionDialogComponent, WalletDecisionDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: WalletDecisionDialogData
  ) {}

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get isReject(): boolean {
    return this.data.mode === 'reject';
  }

  confirm(): void {
    this.dialogRef.close({ reason: this.reason.trim() });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
