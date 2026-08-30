import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { MaterialModule } from 'src/app/material.module';
import { ReviewConfirmDialogComponent } from '../../../../build-review/review-confirm-dialog/review-confirm-dialog.component';
import { BuildingWithUnits, UnitCardItem, UnitPhotoItem } from '../../../../../interfaces/unit-card.model';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';
import { PageBreadcrumbTrailService } from '../../../../../services/page-breadcrumb-trail.service';
import { ReviewEmptyStateComponent } from 'src/app/components/dashboard3/review-empty-state/review-empty-state.component';

type UnitPhotoDecision = 'pending' | 'approved' | 'rejected';

interface UnitReviewPhoto {
  id: number;
  url: string;
  title: string;
  category: string;
  decision: UnitPhotoDecision;
  rejectionReason: string;
  canReview: boolean;
  isMainPhoto: boolean;
  isPendingDeletion: boolean;
  pendingIsMain: boolean | null;
  loadFailed: boolean;
}

interface UnitPhotoGroup {
  title: string;
  icon: string;
  photos: UnitReviewPhoto[];
}

const GROUP_ICON_MAP: Record<string, string> = {
  MainPhoto:  'star',
  Bedroom:    'bed',
  Kitchen:    'chef-hat',
  LivingRoom: 'sofa',
  Bathroom:   'droplets',
  Other:      'photo',
};

@Component({
  selector: 'app-unit-images-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule, ReviewEmptyStateComponent],
  templateUrl: './unit-images-review.component.html',
  styleUrl: './unit-images-review.component.scss'
})
export class UnitImagesReviewComponent implements OnInit, OnDestroy {
  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  buildingId = '';
  unitId = '';
  finalNotes = '';
  isLoading = false;
  isSubmitting = false;
  isReadOnly = false;
  totalPhotoCount = 0;
  minRequired = 0;

  mainPhoto: UnitReviewPhoto | null = null;
  photoGroups: UnitPhotoGroup[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unitsService: UnitsService,
    private translate: TranslateService,
    private dialog: MatDialog,
    private pageBreadcrumbTrail: PageBreadcrumbTrailService,
    private toastr: ToastrService
  ) {}

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get allPhotos(): UnitReviewPhoto[] {
    const main = this.mainPhoto ? [this.mainPhoto] : [];
    return [...main, ...this.photoGroups.flatMap(g => g.photos)];
  }

  get hasRejections(): boolean {
    return this.allPhotos.some(p => p.decision === 'rejected');
  }

  get hasNoPhotos(): boolean {
    if (this.isLoading) return false;
    if (this.totalPhotoCount === 0) return true;
    return this.allPhotos.length > 0 && this.allPhotos.every(p => p.loadFailed);
  }

  get allReviewed(): boolean {
    if (this.hasNoPhotos) return true;
    return this.allPhotos.length > 0 && this.allPhotos.every(p => p.decision !== 'pending');
  }

  get pendingCount(): number {
    return this.allPhotos.filter(p => p.decision === 'pending').length;
  }

  get rejectedPhotos(): UnitReviewPhoto[] {
    return this.allPhotos.filter(p => p.decision === 'rejected');
  }

  get approvedCount(): number {
    return this.allPhotos.filter(p => p.decision === 'approved').length;
  }

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId     = this.route.snapshot.paramMap.get('unitId') ?? '';
    this.isReadOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';

    this.unitsService.getBuildingsWithUnits().subscribe(buildings => {
      this.building = buildings.find(b => b.id === this.buildingId);
      this.unit = this.building?.units.find(u => u.id === this.unitId);
      const lang = this.translate.currentLang || 'ar';
      this.pageBreadcrumbTrail.set([
        { label: this.unit?.title ?? '', translate: false, route: ['/', lang, 'd3', 'unit-review', this.buildingId, this.unitId] }
      ]);
    });

    if (this.unitId) {
      this.isLoading = true;
      this.unitsService.getUnitPhotos(this.unitId).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.totalPhotoCount = response.groups.reduce((sum, g) => sum + g.totalCount, 0);
          this.minRequired = response.minRequired;
          const mainGroup = response.groups.find(g => g.groupKey === 'MainPhoto');
          const otherGroups = response.groups.filter(g => g.groupKey !== 'MainPhoto');

          if (mainGroup?.photos?.length) {
            this.mainPhoto = this.mapPhoto(mainGroup.photos[0]);
          }

          this.photoGroups = otherGroups.map(group => ({
            title: group.groupLabel,
            icon: GROUP_ICON_MAP[group.groupKey] ?? 'photo',
            photos: group.photos.map(p => this.mapPhoto(p))
          }));
        },
        error: () => { this.isLoading = false; }
      });
    }
  }

  ngOnDestroy(): void {
    this.pageBreadcrumbTrail.clear();
  }

  setDecision(photo: UnitReviewPhoto, decision: Exclude<UnitPhotoDecision, 'pending'>): void {
    photo.decision = decision;
    if (decision === 'approved') {
      photo.rejectionReason = '';
    }
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.unitId || !this.allReviewed) return;
    if (decision === 'rejected' && !this.hasNoPhotos && !this.hasRejections) return;

    if (decision === 'approved' && this.approvedCount < this.minRequired) {
      this.toastr.warning(
        this.translate.instant('d3.unitReview.imagesView.insufficientApprovedPhotos', {
          approved: this.approvedCount,
          required: this.minRequired
        })
      );
      return;
    }

    if (decision === 'rejected' && this.hasNoPhotos && !this.finalNotes.trim()) {
      this.toastr.warning(this.translate.instant('d3.unitReview.imagesView.rejectionReasonRequired'));
      return;
    }

    const rejectedWithoutReason = this.allPhotos.some(
      p => p.decision === 'rejected' && !p.rejectionReason.trim()
    );
    if (decision === 'rejected' && !this.hasNoPhotos && rejectedWithoutReason) {
      this.toastr.warning(this.translate.instant('d3.unitReview.imagesView.rejectionReasonRequired'));
      return;
    }

    const isApprove = decision === 'approved';
    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:   isApprove ? 'd3.unitReview.confirm.photosApproveTitle'   : 'd3.unitReview.confirm.photosRejectTitle',
        messageKey: isApprove ? 'd3.unitReview.confirm.photosApproveMessage' : 'd3.unitReview.confirm.photosRejectMessage',
        confirmKey: isApprove ? 'd3.unitReview.confirm.approveAction'        : 'd3.unitReview.confirm.rejectAction',
        tone: isApprove ? 'approve' : 'reject'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      const photos = this.hasNoPhotos ? [] : this.allPhotos.map(p => ({
        mediaId: p.id,
        decision: p.decision === 'approved' ? 'Approved' : 'Rejected',
        rejectionReason: p.decision === 'rejected' ? (p.rejectionReason.trim() || null) : null
      }));

      const overallDecision = isApprove ? 'Approved' : 'Rejected';
      const overallRejectionReason = isApprove ? null : (this.finalNotes.trim() || null);

      this.isSubmitting = true;
      this.unitsService.reviewUnitPhotos(this.unitId, {
        photos,
        decision: overallDecision,
        rejectionReason: overallRejectionReason
      }).subscribe({
        next: () => {
          this.isSubmitting = false;
          if (this.buildingId) {
            this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'photos', decision);
          }
          this.onBack();
        },
        error: () => { this.isSubmitting = false; }
      });
    });
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  private mapPhoto(apiPhoto: UnitPhotoItem): UnitReviewPhoto {
    const normalizedDecision = apiPhoto.decision?.trim().toLowerCase() ?? 'pending';
    const isApproved = normalizedDecision === 'approved';
    const hasPendingPhotoChange =
      apiPhoto.isPendingDeletion
      || apiPhoto.pendingIsMain !== null;

    return {
      id: apiPhoto.mediaId,
      url: apiPhoto.url,
      title: apiPhoto.classificationLabel ?? apiPhoto.classification ?? '',
      category: apiPhoto.classificationCategory ?? '',
      decision: hasPendingPhotoChange
        ? 'pending'
        : (apiPhoto.decision?.toLowerCase() ?? 'pending') as UnitPhotoDecision,
      rejectionReason: hasPendingPhotoChange ? '' : (apiPhoto.rejectionReason ?? ''),
      canReview: hasPendingPhotoChange || !isApproved,
      isMainPhoto: apiPhoto.isMainPhoto,
      isPendingDeletion: apiPhoto.isPendingDeletion,
      pendingIsMain: apiPhoto.pendingIsMain,
      loadFailed: !apiPhoto.url,
    };
  }
}
