import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

export interface OfferConfirmDialogData {
  title: string;
  message: string;
  confirmLabel: string;
  icon: string;
  tone: 'success' | 'warning' | 'danger';
}

@Component({
  selector: 'app-offer-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslateModule, TablerIconsModule],
  templateUrl: './offer-confirm-dialog.component.html',
  styleUrl: './offer-confirm-dialog.component.scss',
})
export class OfferConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<OfferConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: OfferConfirmDialogData,
  ) {}
}
