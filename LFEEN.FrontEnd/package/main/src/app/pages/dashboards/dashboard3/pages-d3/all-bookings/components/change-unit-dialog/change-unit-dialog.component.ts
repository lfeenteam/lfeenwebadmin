import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { BookingService } from '../../services/booking.service';
import { BookingUnitOption } from '../../interfaces/booking.model';

export interface ChangeUnitDialogData {
  bookingId: string;
  bookingNumber: string;
  currentUnitId: number | null;
  propertyId: number | null;
}

// change-unit errorCode → message; anything else falls back to the generic error
const CHANGE_UNIT_ERROR_KEYS: Record<string, string> = {
  LISTING_BANNED:     'd3.listingBan.errors.targetUnitBanned',
  SAME_UNIT:          'd3.bookings.changeUnitDialog.errors.sameUnit',
  UNIT_NOT_FOUND:     'd3.bookings.changeUnitDialog.errors.unitNotFound',
  DIFFERENT_PROPERTY: 'd3.bookings.changeUnitDialog.errors.differentProperty',
};

@Component({
  selector: 'app-change-unit-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './change-unit-dialog.component.html',
  styleUrl: './change-unit-dialog.component.scss'
})
export class ChangeUnitDialogComponent implements OnInit {
  public dialogRef = inject(MatDialogRef<ChangeUnitDialogComponent>);
  public data = inject<ChangeUnitDialogData>(MAT_DIALOG_DATA);
  private translate = inject(TranslateService);
  private bookingService = inject(BookingService);
  private toastr = inject(ToastrService);

  units: BookingUnitOption[] = [];
  loadingUnits = true;
  selectedUnitId: number | null = null;
  reason = '';
  submitting = false;
  /** The booking has no property, so no unit can be offered safely. */
  missingProperty = false;

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  ngOnInit(): void {
    const propertyId = this.data.propertyId;
    // Never fall back to every published unit — a booking can only move within its own property
    if (propertyId == null) {
      this.missingProperty = true;
      this.loadingUnits = false;
      return;
    }

    this.bookingService.getPublishedUnits(propertyId).subscribe({
      next: units => {
        // Also filter client-side in case the API ignores propertyId
        this.units = units.filter(u => u.propertyId === propertyId && u.id !== this.data.currentUnitId);
        this.loadingUnits = false;
      },
      error: () => {
        this.loadingUnits = false;
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
      },
    });
  }

  confirm(): void {
    if (this.selectedUnitId == null || this.submitting || this.missingProperty) return;
    this.submitting = true;
    this.bookingService
      .changeBookingUnit(this.data.bookingId, this.selectedUnitId, this.reason.trim())
      .subscribe({
        next: () => {
          this.toastr.success(this.translate.instant('d3.toast.successOp'));
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.submitting = false;
          const key = CHANGE_UNIT_ERROR_KEYS[err?.error?.errorCode] ?? 'd3.toast.errorOp';
          this.toastr.error(this.translate.instant(key));
        },
      });
  }
}
