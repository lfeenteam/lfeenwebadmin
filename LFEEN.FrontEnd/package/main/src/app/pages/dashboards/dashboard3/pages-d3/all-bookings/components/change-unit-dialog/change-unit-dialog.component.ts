import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { BookingService } from '../../services/booking.service';
import { BookingUnitOption, ChangeBookingUnitResult } from '../../interfaces/booking.model';
import { appLocale } from 'src/app/utils/locale-format.util';

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
  UNIT_NOT_AVAILABLE: 'd3.bookings.changeUnitDialog.errors.unitNotAvailable',
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
  /** Set once the change succeeded — the dialog switches to the price summary. */
  result: ChangeBookingUnitResult | null = null;
  /** Error shown inside the dialog so the admin can pick another unit. */
  errorKey: string | null = null;

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get selectedUnitName(): string {
    return this.units.find(u => u.id === this.selectedUnitId)?.name ?? '';
  }

  /** The backend sent the repricing fields (older backends answer without them). */
  get hasPricing(): boolean {
    return this.result?.priceDifference != null;
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

  onUnitChange(): void {
    this.errorKey = null;
  }

  confirm(): void {
    if (this.selectedUnitId == null || this.submitting || this.missingProperty) return;
    this.submitting = true;
    this.errorKey = null;
    this.bookingService
      .changeBookingUnit(this.data.bookingId, this.selectedUnitId, this.reason.trim())
      .subscribe({
        next: res => {
          this.submitting = false;
          this.toastr.success(this.translate.instant('d3.bookings.changeUnitDialog.result.toast'));
          if (res) {
            // Keep the dialog open so the admin sees the new price; it must not be dismissed by accident.
            this.result = res;
            this.dialogRef.disableClose = true;
          } else {
            this.dialogRef.close(true);
          }
        },
        error: (err) => {
          this.submitting = false;
          const code = err?.error?.errorCode;
          if (code === 'UNIT_NOT_AVAILABLE') {
            // Shown inline next to the picker — the admin needs to choose a different unit.
            this.errorKey = CHANGE_UNIT_ERROR_KEYS[code];
            return;
          }
          const key = CHANGE_UNIT_ERROR_KEYS[code] ?? 'd3.toast.errorOp';
          this.toastr.error(this.translate.instant(key));
        },
      });
  }

  /** After a change the list must refresh however the dialog is closed. */
  close(): void {
    this.dialogRef.close(this.result ? true : undefined);
  }

  fmtMoney(value: number | null | undefined): string {
    if (value == null) return '—';
    const amount = Math.abs(value).toLocaleString(appLocale(this.translate.currentLang), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${amount} ${this.currencyLabel}`;
  }

  get currencyLabel(): string {
    const code = this.result?.currencyCode;
    return !code || code.toUpperCase() === 'SAR' ? this.translate.instant('d3.banRefunds.currencySar') : code;
  }

  get diffClass(): 'up' | 'down' | 'same' {
    const d = this.result?.priceDifference ?? 0;
    return d > 0 ? 'up' : d < 0 ? 'down' : 'same';
  }
}
