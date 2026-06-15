import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

export interface ReviewConfirmDialogData {
  titleKey: string;
  messageKey: string;
  confirmKey: string;
  tone: 'approve' | 'reject';
}

@Component({
  selector: 'app-review-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslateModule, TablerIconsModule],
  templateUrl: './review-confirm-dialog.component.html',
  styleUrl: './review-confirm-dialog.component.scss'
})
export class ReviewConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ReviewConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReviewConfirmDialogData
  ) {}
}
