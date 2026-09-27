import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { REFUND_NOTE_MAX_LENGTH } from '../../../interfaces/listing-ban.model';

export interface RefundResolveDialogData {
  bookingNumber: string | null;
  amount: string;
}

/**
 * Confirms "handled outside the system" for a ManualReview refund.
 * Closes with the trimmed note (or null when left empty) on confirm, undefined on dismiss.
 */
@Component({
  selector: 'app-refund-resolve-dialog',
  standalone: true,
  imports: [FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './refund-resolve-dialog.component.html',
  styleUrl: './refund-resolve-dialog.component.scss'
})
export class RefundResolveDialogComponent {
  private dialogRef = inject(MatDialogRef<RefundResolveDialogComponent, string | null | undefined>);
  readonly data = inject<RefundResolveDialogData>(MAT_DIALOG_DATA);
  private translate = inject(TranslateService);

  readonly maxLength = REFUND_NOTE_MAX_LENGTH;
  note = '';

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  confirm(): void {
    this.dialogRef.close(this.note.trim() || null);
  }

  close(): void {
    this.dialogRef.close(undefined);
  }
}
