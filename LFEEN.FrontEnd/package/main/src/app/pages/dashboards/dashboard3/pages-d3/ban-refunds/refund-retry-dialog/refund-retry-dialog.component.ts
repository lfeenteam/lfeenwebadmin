import { Component, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

export interface RefundRetryDialogData {
  bookingNumber: string | null;
  guestName?: string | null;
  /** Already formatted with its currency, e.g. "1,250 ر.س". */
  amount: string;
}

/**
 * Confirms re-sending a ManualReview refund to the payment gateway.
 * Shared by Ban Refunds and Cancellation Refunds. Closes with true on confirm, undefined on dismiss.
 */
@Component({
  selector: 'app-refund-retry-dialog',
  standalone: true,
  imports: [TablerIconsModule, TranslateModule],
  templateUrl: './refund-retry-dialog.component.html',
  // Same layout as the resolve dialog (classes prefixed "rr-"), plus the retry bits.
  styleUrls: ['../refund-resolve-dialog/refund-resolve-dialog.component.scss', './refund-retry-dialog.component.scss'],
})
export class RefundRetryDialogComponent {
  private dialogRef = inject(MatDialogRef<RefundRetryDialogComponent, true | undefined>);
  readonly data = inject<RefundRetryDialogData>(MAT_DIALOG_DATA);
  private translate = inject(TranslateService);

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  confirm(): void {
    this.dialogRef.close(true);
  }

  close(): void {
    this.dialogRef.close(undefined);
  }
}
