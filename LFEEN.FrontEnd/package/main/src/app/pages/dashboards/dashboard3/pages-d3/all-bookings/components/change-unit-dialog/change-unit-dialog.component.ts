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
}

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

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  ngOnInit(): void {
    this.bookingService.getPublishedUnits().subscribe({
      next: units => {
        this.units = units.filter(u => u.id !== this.data.currentUnitId);
        this.loadingUnits = false;
      },
      error: () => {
        this.loadingUnits = false;
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
      },
    });
  }

  confirm(): void {
    if (this.selectedUnitId == null || this.submitting) return;
    this.submitting = true;
    this.bookingService
      .changeBookingUnit(this.data.bookingId, this.selectedUnitId, this.reason.trim())
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
