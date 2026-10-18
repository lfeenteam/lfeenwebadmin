import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { ToastrService } from 'ngx-toastr';
import { filter } from 'rxjs';
import {
  CATEGORIES_REQUIRING_REASON,
  WALLET_MAX_ATTACHMENTS,
  WalletAttachment,
  WalletCategory,
  WalletCategoryValue,
  WalletLedgerEntry,
  WalletUpdateEntryInput,
} from '../../interfaces/wallet.model';
import { resolveWalletError } from '../../interfaces/wallet-error.util';
import { WalletService } from '../../services/wallet.service';
import { WalletFilePickerComponent } from '../wallet-file-picker/wallet-file-picker.component';

export interface WalletEditEntryDialogData {
  merchantAccountId: string;
  entry: WalletLedgerEntry;
  categories: WalletCategory[];
}

/** The entry as returned by the server after the edit; `undefined` = nothing was saved. */
export type WalletEditEntryDialogResult = WalletLedgerEntry | undefined;

const REASON_MAX = 2000;

@Component({
  selector: 'app-wallet-edit-entry-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule, TablerIconsModule, WalletFilePickerComponent],
  templateUrl: './wallet-edit-entry-dialog.component.html',
  styleUrls: [
    '../wallet-adjust-dialog/wallet-adjust-dialog.component.scss',
    './wallet-edit-entry-dialog.component.scss',
  ]
})
export class WalletEditEntryDialogComponent {
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private service = inject(WalletService);

  readonly reasonMax = REASON_MAX;

  submitting = false;

  category: WalletCategoryValue | null;
  reason: string;
  newFiles: File[] = [];
  private removedIds = new Set<string>();

  constructor(
    public dialogRef: MatDialogRef<WalletEditEntryDialogComponent, WalletEditEntryDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: WalletEditEntryDialogData
  ) {
    this.category = data.entry.category;
    this.reason = data.entry.description ?? '';

    dialogRef.disableClose = true;
    dialogRef.backdropClick().subscribe(() => this.close());
    dialogRef.keydownEvents().pipe(filter(e => e.key === 'Escape')).subscribe(() => this.close());
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get isCredit(): boolean {
    return this.data.entry.direction === 'Credit';
  }

  fmtAmount(value: number): string {
    return value.toLocaleString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  categoryLabel(c: WalletCategory): string {
    return this.translate.currentLang === 'en' ? c.nameEn : c.nameAr;
  }

  get keptAttachments(): WalletAttachment[] {
    return this.data.entry.attachments.filter(a => !this.removedIds.has(a.id));
  }

  get removedAttachments(): WalletAttachment[] {
    return this.data.entry.attachments.filter(a => this.removedIds.has(a.id));
  }

  /** The 5-file cap applies to the final set: existing − removed + new. */
  get newFileSlots(): number {
    return Math.max(0, WALLET_MAX_ATTACHMENTS - this.keptAttachments.length);
  }

  removeAttachment(id: string): void {
    if (this.submitting) return;
    this.removedIds.add(id);
  }

  restoreAttachment(id: string): void {
    if (this.submitting) return;
    if (this.keptAttachments.length + this.newFiles.length >= WALLET_MAX_ATTACHMENTS) {
      this.toastr.error(this.translate.instant('d3.wallet.files.countError'));
      return;
    }
    this.removedIds.delete(id);
  }

  formatSize(bytes: number): string {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  get reasonRequired(): boolean {
    return !!this.category && CATEGORIES_REQUIRING_REASON.includes(this.category);
  }

  private get changes(): WalletUpdateEntryInput {
    const original = this.data.entry;
    const changes: WalletUpdateEntryInput = {};
    const reason = this.reason.trim();
    if (reason !== (original.description ?? '').trim()) changes.reason = reason;
    if (this.category && this.category !== original.category) changes.category = this.category;
    if (this.newFiles.length) changes.newFiles = this.newFiles;
    if (this.removedIds.size) changes.removedAttachmentIds = [...this.removedIds];
    return changes;
  }

  get hasChanges(): boolean {
    return Object.keys(this.changes).length > 0;
  }

  get canSave(): boolean {
    const reason = this.reason.trim();
    return !this.submitting
      && this.hasChanges
      && reason.length <= REASON_MAX
      && (!this.reasonRequired || !!reason);
  }

  save(): void {
    if (!this.canSave) return;
    this.submitting = true;
    this.service.updateEntry(this.data.merchantAccountId, this.data.entry.id, this.changes).subscribe({
      next: updated => {
        this.submitting = false;
        this.toastr.success(this.translate.instant('d3.wallet.edit.success'));
        this.dialogRef.close(updated);
      },
      error: err => {
        this.submitting = false;
        this.toastr.error(resolveWalletError(err, this.translate));
      },
    });
  }

  close(): void {
    if (this.submitting) return;
    this.dialogRef.close(undefined);
  }
}
