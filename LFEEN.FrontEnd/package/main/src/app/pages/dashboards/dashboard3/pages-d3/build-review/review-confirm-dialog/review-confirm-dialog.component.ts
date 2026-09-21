import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { Observable } from 'rxjs';

export interface ReviewConfirmDialogData {
  titleKey:   string;
  messageKey: string;
  confirmKey: string;
  tone: 'approve' | 'reject';
  /** Optional — when provided the dialog owns the API call and shows a success state */
  onConfirm?:          () => Observable<any>;
  successTitleKey?:    string;
  successMessageKey?:  string;
}

export type D3DialogState = 'idle' | 'loading' | 'success' | 'error';

@Component({
  selector: 'app-review-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslateModule, TablerIconsModule],
  templateUrl: './review-confirm-dialog.component.html',
  styleUrl: './review-confirm-dialog.component.scss'
})
export class ReviewConfirmDialogComponent {
  state: D3DialogState = 'idle';

  constructor(
    public dialogRef: MatDialogRef<ReviewConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ReviewConfirmDialogData
  ) {}

  confirm(): void {
    if (!this.data.onConfirm) {
      // Legacy mode — caller handles the API call via afterClosed()
      this.dialogRef.close(true);
      return;
    }

    // Managed mode — dialog calls the API and shows success/error state
    this.state = 'loading';
    this.data.onConfirm().subscribe({
      next: () => {
        this.state = 'success';
        setTimeout(() => this.dialogRef.close(true), 1700);
      },
      error: () => {
        this.state = 'error';
        setTimeout(() => { this.state = 'idle'; }, 2500);
      }
    });
  }

  get isLoading(): boolean { return this.state === 'loading'; }
  get isSuccess(): boolean { return this.state === 'success'; }
  get isError():   boolean { return this.state === 'error';   }
}
