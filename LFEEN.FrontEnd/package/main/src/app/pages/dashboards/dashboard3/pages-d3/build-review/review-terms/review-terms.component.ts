import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { BuildingReviewService } from '../../../services/building-review.service';
import {
  PropertyTermCondition,
  TermsReviewPayload,
  TermsReviewResponse
} from '../../../interfaces/building-card.model';
import { ReviewConfirmDialogComponent } from '../review-confirm-dialog/review-confirm-dialog.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReviewEmptyStateComponent } from 'src/app/components/dashboard3/review-empty-state/review-empty-state.component';

interface Rule {
  id: number;
  title: string;
  icon: string;
  enabled: boolean;
}

@Component({
  selector: 'app-review-terms',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, FormsModule, TranslateModule, ReviewEmptyStateComponent],
  templateUrl: './review-terms.component.html',
  styleUrl: './review-terms.component.scss'
})
export class ReviewTermsComponent implements OnInit {
  @Input() propertyId = '';
  @Input() readOnly = false;
  @Output() back = new EventEmitter<void>();
  @Output() approve = new EventEmitter<TermsReviewResponse>();

  private buildingService = inject(BuildingReviewService);
  private toastr = inject(ToastrService);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  isLoading = false;
  isSubmitting = false;
  checkInTime = '-';
  checkOutTime = '-';
  earlyCheckIn = false;
  earlyCheckInFrom: string | null = null;
  rejectionReason = '';
  generalRules: Rule[] = [];
  customRules: string[] = [];

  ngOnInit(): void {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadTerms());

    this.loadTerms();
  }

  private loadTerms(): void {
    if (!this.propertyId) return;

    this.isLoading = true;
    this.buildingService.getPropertyTerms(this.propertyId).subscribe({
      next: (data) => {
        this.isLoading = false;
        this.checkInTime = data.checkInTime || '-';
        this.checkOutTime = data.checkOutTime || '-';
        this.earlyCheckIn = data.isEarlyCheckInAllowed;
        this.earlyCheckInFrom = data.earlyCheckInFrom;
        this.rejectionReason = data.rejectionReason ?? '';
        this.generalRules = data.conditions.map(condition => this.mapCondition(condition));
        this.customRules = data.customRules.map(rule => rule.description);
      },
      error: () => {
        this.isLoading = false;
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
      }
    });
  }

  confirmDecision(decision: 1 | 2): void {
    if (!this.propertyId || this.isSubmitting) return;

    const reason = this.rejectionReason.trim();
    if (decision === 2 && !reason) {
      this.toastr.warning(this.translate.instant('d3.buildReview.terms.rejectionReasonRequired'));
      return;
    }

    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey: decision === 2
          ? 'd3.buildReview.confirm.termsRejectTitle'
          : 'd3.buildReview.confirm.termsApproveTitle',
        messageKey: decision === 2
          ? 'd3.buildReview.confirm.termsRejectMessage'
          : 'd3.buildReview.confirm.termsApproveMessage',
        confirmKey: decision === 2
          ? 'd3.buildReview.confirm.rejectAction'
          : 'd3.buildReview.confirm.approveAction',
        tone: decision === 2 ? 'reject' : 'approve'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) this.submitDecision(decision, reason);
    });
  }

  private submitDecision(decision: 1 | 2, reason: string): void {
    const payload: TermsReviewPayload = {
      decision: decision === 2 ? 'Rejected' : 'Approved',
      rejectionReason: decision === 2 ? reason : null
    };

    this.isSubmitting = true;
    this.buildingService.submitTermsReview(this.propertyId, payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        const messageKey = response.decision === 'Rejected'
          ? 'd3.buildReview.terms.rejectSuccess'
          : 'd3.buildReview.terms.approveSuccess';
        this.toastr.success(this.translate.instant(messageKey));
        this.approve.emit(response);
      },
      error: (err) => {
        this.isSubmitting = false;
        const errorCode = err?.error?.code ?? err?.error?.errorCode;
        const messageKey = errorCode === 'REJECTION_REASON_REQUIRED'
          ? 'd3.buildReview.terms.rejectionReasonRequired'
          : 'd3.toast.errorOp';
        this.toastr.error(this.translate.instant(messageKey));
      }
    });
  }

  private mapCondition(condition: PropertyTermCondition): Rule {
    return {
      id: condition.id,
      title: condition.name,
      icon: this.getConditionIcon(condition.conditionKey),
      enabled: condition.isSelected
    };
  }

  private getConditionIcon(conditionKey: string): string {
    const key = conditionKey.toLowerCase();
    if (key.includes('smok')) return 'ban';
    if (key.includes('pet')) return 'dog';
    if (key.includes('part') || key.includes('event')) return 'music';
    if (key.includes('child')) return 'baby-carriage';
    if (key.includes('camera') || key.includes('photo')) return 'camera-off';
    return 'checklist';
  }
}
