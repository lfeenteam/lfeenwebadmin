import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { ToastrService } from 'ngx-toastr';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

export interface SettlementDetailDialogData {
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
  bankVerified: boolean;
  paymentMethodKey: string;
  paymentMethodIconName: string;
}

export type SettlementDialogResult =
  | { decision: 'approved' }
  | { decision: 'rejected'; reason: string }
  | undefined;

type DialogStep = 'details' | 'confirmTransfer' | 'success' | 'confirmReject' | 'rejectSuccess';

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

  step: DialogStep = 'details';

  // ── Transfer confirmation step ─────────────────────────────
  actualAmount: number | null = null;
  trxId = '';
  receiptFile: File | null = null;
  isDragging = false;

  // ── Success step ────────────────────────────────────────────
  trxNumber = '';
  executionTime: Date | null = null;

  // ── Reject confirmation step ───────────────────────────────
  rejectReason = '';
  rejectionTime: Date | null = null;

  constructor(
    public dialogRef: MatDialogRef<SettlementDetailDialogComponent, SettlementDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: SettlementDetailDialogData
  ) {}

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

  get canConfirmReject(): boolean {
    return !!this.rejectReason.trim();
  }

  confirmReject(): void {
    if (!this.canConfirmReject) return;
    this.rejectionTime = new Date();
    this.step = 'rejectSuccess';
  }

  get rejectionTimeLabel(): string {
    if (!this.rejectionTime) return '';
    const locale = this.translate.currentLang === 'en' ? enUS : ar;
    const date = format(this.rejectionTime, 'd MMMM yyyy', { locale });
    const time = format(this.rejectionTime, 'hh:mm a', { locale });
    return `${date} • ${time}`;
  }

  finishReject(): void {
    this.dialogRef.close({ decision: 'rejected', reason: this.rejectReason.trim() });
  }

  close(): void {
    this.dialogRef.close(undefined);
  }

  copyIban(): void {
    navigator.clipboard?.writeText(this.data.iban).then(() => {
      this.toastr.success(this.translate.instant('d3.settlements.detail.ibanCopied'));
    });
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.receiptFile = input.files[0];
    }
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.receiptFile = file;
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

  get canConfirmTransfer(): boolean {
    return !!this.actualAmount && this.actualAmount > 0 && !!this.trxId.trim() && !!this.receiptFile;
  }

  confirmTransfer(): void {
    if (!this.canConfirmTransfer) return;
    // Mock system-generated reference — a real backend would return this from the transfer call.
    this.trxNumber = '#TRX-' + Math.floor(10000000 + Math.random() * 90000000);
    this.executionTime = new Date();
    this.step = 'success';
  }

  get formattedTransferredAmount(): string {
    const value = this.actualAmount ?? 0;
    return value.toLocaleString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  get executionTimeLabel(): string {
    if (!this.executionTime) return '';
    const locale = this.translate.currentLang === 'en' ? enUS : ar;
    const time = format(this.executionTime, 'hh:mm a', { locale });
    return this.translate.instant('d3.settlements.detail.now', { time });
  }

  finish(): void {
    this.dialogRef.close({ decision: 'approved' });
  }
}
