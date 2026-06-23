import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { ReviewConfirmDialogComponent } from '../../../../build-review/review-confirm-dialog/review-confirm-dialog.component';
import { BuildingWithUnits, UnitCardItem, UnitPhotoItem } from '../../../../../interfaces/unit-card.model';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';

type UnitPhotoDecision = 'pending' | 'approved' | 'rejected';

interface UnitReviewPhoto {
  id: number;
  url: string;
  title: string;
  category: string;
  decision: UnitPhotoDecision;
  rejectionReason: string;
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
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule],
  templateUrl: './unit-images-review.component.html',
  styleUrl: './unit-images-review.component.scss'
})
export class UnitImagesReviewComponent implements OnInit {
  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  buildingId = '';
  unitId = '';
  finalNotes = '';
  isLoading = false;
  isSubmitting = false;
  isReadOnly = false;
  totalPhotoCount = 0;

  mainPhoto: UnitReviewPhoto | null = null;
  photoGroups: UnitPhotoGroup[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unitsService: UnitsService,
    private translate: TranslateService,
    private dialog: MatDialog
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

  get allReviewed(): boolean {
    return this.allPhotos.length > 0 && this.allPhotos.every(p => p.decision !== 'pending');
  }

  get pendingCount(): number {
    return this.allPhotos.filter(p => p.decision === 'pending').length;
  }

  get rejectedPhotos(): UnitReviewPhoto[] {
    return this.allPhotos.filter(p => p.decision === 'rejected');
  }

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId     = this.route.snapshot.paramMap.get('unitId') ?? '';
    this.isReadOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';

    this.unitsService.getBuildingsWithUnits().subscribe(buildings => {
      this.building = buildings.find(b => b.id === this.buildingId);
      this.unit = this.building?.units.find(u => u.id === this.unitId);
    });

    if (this.unitId) {
      this.isLoading = true;
      this.unitsService.getUnitPhotos(this.unitId).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.totalPhotoCount = response.groups.reduce((sum, g) => sum + g.totalCount, 0);
          const mainGroup = response.groups.find(g => g.groupKey === 'MainPhoto');
          const otherGroups = response.groups.filter(g => g.groupKey !== 'MainPhoto');

          if (mainGroup?.photos?.length) {
            this.mainPhoto = this.mapPhoto(mainGroup.photos[0]);
          }

          this.photoGroups = otherGroups.map(group => ({
            title: group.groupKey,
            icon: GROUP_ICON_MAP[group.groupKey] ?? 'photo',
            photos: group.photos.map(p => this.mapPhoto(p))
          }));
        },
        error: () => { this.isLoading = false; }
      });
    }
  }

  setDecision(photo: UnitReviewPhoto, decision: Exclude<UnitPhotoDecision, 'pending'>): void {
    photo.decision = decision;
    if (decision === 'approved') {
      photo.rejectionReason = '';
    }
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.unitId || !this.allReviewed) return;

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

      const photos = this.allPhotos.map(p => ({
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
    return {
      id: apiPhoto.mediaId,
      url: apiPhoto.url,
      title: apiPhoto.classification ?? '',
      category: apiPhoto.classificationCategory ?? '',
      decision: (apiPhoto.decision?.toLowerCase() ?? 'pending') as UnitPhotoDecision,
      rejectionReason: apiPhoto.rejectionReason ?? ''
    };
  }
}
