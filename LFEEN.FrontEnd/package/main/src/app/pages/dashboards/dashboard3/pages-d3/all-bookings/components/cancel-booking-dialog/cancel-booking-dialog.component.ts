import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { BookingService } from '../../services/booking.service';

export interface CancelBookingDialogData {
  bookingId: string;
  bookingNumber: string;
}

@Component({
  selector: 'app-cancel-booking-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './cancel-booking-dialog.component.html',
  styleUrl: './cancel-booking-dialog.component.scss'
})
export class CancelBookingDialogComponent {
  public dialogRef = inject(MatDialogRef<CancelBookingDialogComponent>);
  public data = inject<CancelBookingDialogData>(MAT_DIALOG_DATA);
  private translate = inject(TranslateService);
  private bookingService = inject(BookingService);
  private toastr = inject(ToastrService);

  reason = '';
  submitting = false;

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  confirm(): void {
    if (this.submitting) return;
    this.submitting = true;
    this.bookingService
      .cancelBooking(this.data.bookingId, this.reason.trim())
      .subscribe({
        next: () => {
          this.toastr.success(this.translate.instant('d3.toast.successOp'));
          this.dialogRef.close(true);
        },
        error: () => {
          this.submitting = false;
          this.toastr.error(this.translate.instant('d3.toast.errorOp'));
        },
      });
  }
}
