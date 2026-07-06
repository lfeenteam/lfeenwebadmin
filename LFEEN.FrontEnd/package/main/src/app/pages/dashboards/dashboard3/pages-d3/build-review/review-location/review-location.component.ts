import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { BuildingReviewInfo, LocalSectionDecisionResult } from '../../../interfaces/building-card.model';
import { ReviewConfirmDialogComponent } from '../review-confirm-dialog/review-confirm-dialog.component';

@Component({
  selector: 'app-review-location',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './review-location.component.html',
  styleUrl: './review-location.component.scss'
})
export class ReviewLocationComponent {
  @Input() building!: BuildingReviewInfo;
  @Input() readOnly = false;
  @Output() back = new EventEmitter<void>();
  @Output() approve = new EventEmitter<LocalSectionDecisionResult>();

  isSubmitting = false;
  rejectionReason = '';

  constructor(
    private translate: TranslateService,
    private toastr: ToastrService,
    private dialog: MatDialog
  ) {}

  get hasCoordinates(): boolean {
    return this.building?.latitude != null && this.building?.longitude != null;
  }

  get mapUrl(): string | null {
    if (!this.hasCoordinates) return null;
    return `https://www.google.com/maps?q=${this.building.latitude},${this.building.longitude}`;
  }

  confirmDecision(decision: 'Approved' | 'Rejected'): void {
    if (this.isSubmitting) return;

    const reason = this.rejectionReason.trim();
    if (decision === 'Rejected' && !reason) {
      this.toastr.warning(this.translate.instant('d3.buildReview.location.rejectionReasonRequired'));
      return;
    }

    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.locationRejectTitle'
          : 'd3.buildReview.confirm.locationApproveTitle',
        messageKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.locationRejectMessage'
          : 'd3.buildReview.confirm.locationApproveMessage',
        confirmKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.rejectAction'
          : 'd3.buildReview.confirm.approveAction',
        tone: decision === 'Rejected' ? 'reject' : 'approve'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) this.submitDecision(decision);
    });
  }

  private submitDecision(decision: 'Approved' | 'Rejected'): void {
    this.isSubmitting = true;
    const messageKey = decision === 'Rejected'
      ? 'd3.buildReview.location.rejectSuccess'
      : 'd3.buildReview.location.approveSuccess';
    this.toastr.success(this.translate.instant(messageKey));
    this.isSubmitting = false;
    this.approve.emit({ decision });
  }
}
