import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { BuildingReviewService } from '../../../services/building-review.service';
import { PhotoItem, PhotoReviewPayload, PhotoReviewResponse } from '../../../interfaces/building-card.model';
import { ReviewConfirmDialogComponent } from '../review-confirm-dialog/review-confirm-dialog.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { ReviewEmptyStateComponent } from 'src/app/components/dashboard3/review-empty-state/review-empty-state.component';

interface LocalPhoto {
  mediaId: number;
  url: string;
  fileName: string;
  classification: string;
  isMainPhoto: boolean;
  isPendingDeletion: boolean;
  pendingIsMain: boolean | null;
  decision: 'Pending' | 'Approved' | 'Rejected';
  rejectionReason: string;
  canReview: boolean;
  loadFailed: boolean;
}

interface LocalGroup {
  groupKey: string;
  photos: LocalPhoto[];
}

@Component({
  selector: 'app-review-image',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, DashboardLoadingComponent, ReviewEmptyStateComponent],
  templateUrl: './review-image.component.html',
  styleUrl: './review-image.component.scss'
})
export class ReviewImageComponent implements OnInit {
  @Input() propertyId = '';
  @Input() readOnly = false;
  @Output() back    = new EventEmitter<void>();
  @Output() approve = new EventEmitter<PhotoReviewResponse>();

  private buildingService = inject(BuildingReviewService);
  private toastr = inject(ToastrService);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  isLoading   = false;
  isSubmitting = false;
  mainPhoto: LocalPhoto | null = null;
  photoGroups: LocalGroup[]    = [];
  sectionRejectionReason       = '';
  minRequired = 0;

  ngOnInit(): void {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadPhotos());

    this.loadPhotos();
  }

  private loadPhotos(): void {
    if (!this.propertyId) return;
    this.isLoading = true;
    this.buildingService.getPropertyPhotos(this.propertyId).subscribe({
      next: (data) => {
        this.isLoading = false;
        this.mainPhoto = null;
        this.photoGroups = [];
        this.minRequired = data.minRequired;
        for (const g of data.groups) {
          const localPhotos: LocalPhoto[] = g.photos.map(p => this.mapPhoto(p));
          if (g.groupKey === 'MainPhoto') {
            this.mainPhoto = localPhotos[0] ?? null;
          } else {
            this.photoGroups.push({ groupKey: g.groupKey, photos: localPhotos });
          }
        }
      },
      error: () => { this.isLoading = false; }
    });
  }

  get allPhotos(): LocalPhoto[] {
    return [
      ...(this.mainPhoto ? [this.mainPhoto] : []),
      ...this.photoGroups.flatMap(g => g.photos)
    ];
  }

  get hasRejections(): boolean {
    return this.allPhotos.some(p => p.decision === 'Rejected');
  }

  get hasPendingPhotos(): boolean {
    return this.allPhotos.some(p => p.decision === 'Pending');
  }

  get hasNoViewablePhotos(): boolean {
    return this.allPhotos.length === 0 || this.allPhotos.every(p => p.loadFailed);
  }

  get rejectedGroups(): { title: string; reason: string }[] {
    const result: { title: string; reason: string }[] = [];
    if (this.mainPhoto?.decision === 'Rejected') {
      result.push({ title: this.mainPhoto.fileName, reason: this.mainPhoto.rejectionReason });
    }
    for (const g of this.photoGroups) {
      const rejected = g.photos.filter(p => p.decision === 'Rejected');
      if (rejected.length > 0) {
        result.push({
          title: g.groupKey,
          reason: rejected.map(p => p.rejectionReason).filter(Boolean).join('، ')
        });
      }
    }
    return result;
  }

  setDecision(photo: LocalPhoto, decision: 'Approved' | 'Rejected'): void {
    if (this.readOnly || !photo.canReview) return;
    photo.decision = decision;
    if (decision === 'Approved') photo.rejectionReason = '';
  }

  private mapPhoto(photo: PhotoItem): LocalPhoto {
    const hasPendingPhotoChange =
      photo.isPendingDeletion
      || photo.pendingIsMain !== null;

    return {
      mediaId:        photo.mediaId,
      url:            photo.url,
      fileName:       photo.fileName,
      classification: photo.classification,
      isMainPhoto:    photo.isMainPhoto,
      isPendingDeletion: photo.isPendingDeletion,
      pendingIsMain: photo.pendingIsMain,
      decision:       hasPendingPhotoChange ? 'Pending' : photo.decision,
      rejectionReason: hasPendingPhotoChange ? '' : (photo.rejectionReason ?? ''),
      canReview:      hasPendingPhotoChange || photo.decision !== 'Approved',
      loadFailed:     !photo.url
    };
  }

  confirmSubmit(decision: 'Approved' | 'Rejected'): void {
    if (!this.propertyId || this.isSubmitting) return;

    const noPhotos = this.hasNoViewablePhotos;

    if (!noPhotos && this.allPhotos.some(p => p.decision === 'Pending')) {
      this.toastr.warning(this.translate.instant('d3.buildReview.images.pendingDecisionRequired'));
      return;
    }

    if (decision === 'Approved' && this.hasRejections) {
      this.toastr.warning(this.translate.instant('d3.buildReview.images.approveAllRequired'));
      return;
    }

    if (decision === 'Rejected' && !noPhotos && !this.hasRejections) {
      this.toastr.warning(this.translate.instant('d3.buildReview.images.rejectedPhotoRequired'));
      return;
    }

    if (decision === 'Rejected' && noPhotos && !this.sectionRejectionReason.trim()) {
      this.toastr.warning(this.translate.instant('d3.buildReview.images.rejectionReasonRequired'));
      return;
    }

    const rejectedWithoutReason = this.allPhotos.some(
      p => p.decision === 'Rejected' && !p.rejectionReason.trim()
    );
    if (decision === 'Rejected' && !noPhotos && rejectedWithoutReason) {
      this.toastr.warning(this.translate.instant('d3.buildReview.images.rejectionReasonRequired'));
      return;
    }

    const approvedCount = this.allPhotos.filter(p => p.decision === 'Approved').length;
    if (decision === 'Approved' && approvedCount < this.minRequired) {
      this.toastr.warning(
        this.translate.instant('d3.buildReview.images.insufficientApprovedPhotos', {
          approved: approvedCount,
          required: this.minRequired
        })
      );
      return;
    }

    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.imagesRejectTitle'
          : 'd3.buildReview.confirm.imagesApproveTitle',
        messageKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.imagesRejectMessage'
          : 'd3.buildReview.confirm.imagesApproveMessage',
        confirmKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.rejectAction'
          : 'd3.buildReview.confirm.approveAction',
        tone: decision === 'Rejected' ? 'reject' : 'approve'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) this.submitReview(decision, approvedCount);
    });
  }

  private submitReview(decision: 'Approved' | 'Rejected', approvedCount: number): void {
    const hasRejection = decision === 'Rejected';
    const payload: PhotoReviewPayload = {
      photos: this.hasNoViewablePhotos ? [] : this.allPhotos.map(p => ({
        mediaId:         p.mediaId,
        decision:        p.decision === 'Rejected' ? 'Rejected' : 'Approved',
        rejectionReason: p.decision === 'Rejected' ? p.rejectionReason.trim() : null
      })),
      decision,
      rejectionReason: hasRejection ? (this.sectionRejectionReason.trim() || null) : null
    };

    this.isSubmitting = true;
    this.buildingService.submitPhotosReview(this.propertyId, payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        const messageKey = response.decision === 'Rejected'
          ? 'd3.buildReview.images.rejectSuccess'
          : 'd3.buildReview.images.approveSuccess';
        this.toastr.success(
          this.translate.instant(messageKey, {
            status: this.translate.instant(
              `d3.buildReview.images.overallStatus.${response.overallStatus}`
            )
          })
        );
        this.approve.emit(response);
      },
      error: (err) => {
        this.isSubmitting = false;
        const errorCode = err?.error?.code ?? err?.error?.errorCode;
        const messageKey =
          errorCode === 'REJECTION_REASON_REQUIRED'
            ? 'd3.buildReview.images.rejectionReasonRequired'
            : errorCode === 'INSUFFICIENT_APPROVED_PHOTOS'
              ? 'd3.buildReview.images.insufficientApprovedPhotos'
              : 'd3.toast.errorOp';
        this.toastr.error(this.translate.instant(messageKey, {
          approved: approvedCount,
          required: this.minRequired
        }));
        console.error('Photo review submission failed', err);
      }
    });
  }

  goBack(): void {
    this.back.emit();
  }
}
