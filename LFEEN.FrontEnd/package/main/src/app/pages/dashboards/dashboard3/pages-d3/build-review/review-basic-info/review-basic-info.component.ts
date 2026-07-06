import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import {
  BasicDataReviewPayload,
  BasicDataReviewResponse,
  BuildingReviewInfo,
  PropertyBasicDataResponse
} from '../../../interfaces/building-card.model';
import { ReviewConfirmDialogComponent } from '../review-confirm-dialog/review-confirm-dialog.component';
import { BuildingReviewService } from '../../../services/building-review.service';

@Component({
  selector: 'app-review-basic-info',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './review-basic-info.component.html',
  styleUrl: './review-basic-info.component.scss'
})
export class ReviewBasicInfoComponent implements OnInit {
  @Input() building!: BuildingReviewInfo;
  @Input() propertyId = '';
  @Input() readOnly = false;
  @Output() back = new EventEmitter<void>();
  @Output() approve = new EventEmitter<BasicDataReviewResponse>();

  private buildingService = inject(BuildingReviewService);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private dialog = inject(MatDialog);

  basicData: PropertyBasicDataResponse | null = null;
  isLoading = false;
  isSubmitting = false;
  rejectionReason = '';

  // Not part of the basic-data API response yet, kept as static placeholders until backed by real data.
  readonly amenities = [
    { icon: 'truck', labelKey: 'd3.buildReview.basicInfo.amenityLabels.cleaning' },
    { icon: 'droplet', labelKey: 'd3.buildReview.basicInfo.amenityLabels.cleaning' },
    { icon: 'spray', labelKey: 'd3.buildReview.basicInfo.amenityLabels.cleaning' },
    { icon: 'trash', labelKey: 'd3.buildReview.basicInfo.amenityLabels.cleaning' },
    { icon: 'wash', labelKey: 'd3.buildReview.basicInfo.amenityLabels.cleaning' },
    { icon: 'robot', labelKey: 'd3.buildReview.basicInfo.amenityLabels.smartAssistant' },
    { icon: 'shield-check', labelKey: 'd3.buildReview.basicInfo.amenityLabels.security' },
    { icon: 'swimming', labelKey: 'd3.buildReview.basicInfo.amenityLabels.pool' },
    { icon: 'barbell', labelKey: 'd3.buildReview.basicInfo.amenityLabels.gym' },
    { icon: 'parking-circle', labelKey: 'd3.buildReview.basicInfo.amenityLabels.parking' }
  ];

  ngOnInit(): void {
    this.loadBasicData();
  }

  private loadBasicData(): void {
    if (!this.propertyId) return;

    this.isLoading = true;
    this.buildingService.getPropertyBasicData(this.propertyId).subscribe({
      next: (data) => {
        this.isLoading = false;
        this.basicData = data;
        this.rejectionReason = data.rejectionReason ?? '';
      },
      error: () => {
        this.isLoading = false;
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
      }
    });
  }

  get controlFeatures() {
    return [
      {
        icon: 'key',
        titleKey: 'd3.buildReview.basicInfo.smartLockTitle',
        descKey: 'd3.buildReview.basicInfo.smartLockDesc',
        enabled: !!this.basicData?.hasLock
      },
      {
        icon: 'box',
        titleKey: 'd3.buildReview.basicInfo.extraServicesTitle',
        descKey: 'd3.buildReview.basicInfo.extraServicesDesc',
        enabled: !!this.basicData?.hasUnitServices
      }
    ];
  }

  get totalFloors(): number {
    return this.basicData?.numberOfFloors ?? 0;
  }

  get floors() {
    return (this.basicData?.floors ?? [])
      .slice()
      .sort((a, b) => a.floorIndex - b.floorIndex)
      .map(floor => ({
        number: String(floor.floorIndex + 1).padStart(2, '0'),
        name: floor.name,
        units: floor.unitCount
      }));
  }

  get usageDisplay(): string {
    const usage = this.basicData?.usage;
    if (!usage) return '-';
    const key = `d3.buildReview.basicInfo.usageValues.${usage}`;
    const translated = this.translate.instant(key);
    return translated === key ? usage : translated;
  }

  confirmDecision(decision: 'Approved' | 'Rejected'): void {
    if (this.isLoading || this.isSubmitting) return;

    const reason = this.rejectionReason.trim();
    if (decision === 'Rejected' && !reason) {
      this.toastr.warning(this.translate.instant('d3.buildReview.basicInfo.rejectionReasonRequired'));
      return;
    }

    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.basicInfoRejectTitle'
          : 'd3.buildReview.confirm.basicInfoApproveTitle',
        messageKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.basicInfoRejectMessage'
          : 'd3.buildReview.confirm.basicInfoApproveMessage',
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
    if (!this.propertyId || this.isSubmitting) return;

    const payload: BasicDataReviewPayload = {
      decision: decision === 'Rejected' ? '2' : '1',
      rejectionReason: decision === 'Rejected' ? this.rejectionReason.trim() : null
    };

    this.isSubmitting = true;
    this.buildingService.submitBasicDataReview(this.propertyId, payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        const messageKey = response.decision === 'Rejected'
          ? 'd3.buildReview.basicInfo.rejectSuccess'
          : 'd3.buildReview.basicInfo.approveSuccess';
        this.toastr.success(this.translate.instant(messageKey));
        this.approve.emit(response);
      },
      error: (err) => {
        this.isSubmitting = false;
        const errorCode = err?.error?.code ?? err?.error?.errorCode;
        const messageKey = errorCode === 'REJECTION_REASON_REQUIRED'
          ? 'd3.buildReview.basicInfo.rejectionReasonRequired'
          : 'd3.toast.errorOp';
        this.toastr.error(this.translate.instant(messageKey));
      }
    });
  }
}
