import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { ReviewConfirmDialogComponent } from '../../../../build-review/review-confirm-dialog/review-confirm-dialog.component';
import { BuildingWithUnits, UnitAccessResponse, UnitApiDetailItem, UnitCardItem } from '../../../../../interfaces/unit-card.model';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';
import { PageBreadcrumbTrailService } from '../../../../../services/page-breadcrumb-trail.service';

type AccessPhotoDecision = 'pending' | 'approved' | 'rejected';

interface AccessPhoto {
  category: string;
  image: string;
  titleKey: string;
  tagKey: string;
  decision: AccessPhotoDecision;
  rejectionReason: string;
  canReview: boolean;
}

const CATEGORY_MAP: Record<string, { titleKey: string; tagKey: string }> = {
  BuildingExterior: {
    titleKey: 'd3.unitReview.accessView.photos.street',
    tagKey:   'd3.unitReview.accessView.tags.external',
  },
  BuildingEntrance: {
    titleKey: 'd3.unitReview.accessView.photos.mainEntrance',
    tagKey:   'd3.unitReview.accessView.tags.inside',
  },
  Hallway: {
    titleKey: 'd3.unitReview.accessView.photos.corridor',
    tagKey:   'd3.unitReview.accessView.tags.floor',
  },
  UnitDoor: {
    titleKey: 'd3.unitReview.accessView.photos.unitDoor',
    tagKey:   'd3.unitReview.accessView.tags.unit',
  },
};

@Component({
  selector: 'app-unit-access-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule],
  templateUrl: './unit-access-review.component.html',
  styleUrl: './unit-access-review.component.scss'
})
export class UnitAccessReviewComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageBreadcrumbTrail = inject(PageBreadcrumbTrailService);

  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  unitDetail: UnitApiDetailItem | null = null;
  buildingId = '';
  unitId = '';
  rejectionNote = '';
  isLoading = false;
  isReadOnly = false;
  hasStartedReview = false;
  accessData: UnitAccessResponse | null = null;
  accessPhotos: AccessPhoto[] = [];

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

  get unitInitials(): string {
    const name = this.unit?.title || this.unitDetail?.propertyName || '';
    return name.trim().slice(0, 2);
  }

  get hasRejectedPhoto(): boolean {
    return this.accessPhotos.some(p => p.decision === 'rejected');
  }

  get allReviewed(): boolean {
    return this.accessPhotos.length > 0 && this.accessPhotos.every(p => p.decision !== 'pending');
  }

  get pendingCount(): number {
    return this.accessPhotos.filter(p => p.decision === 'pending').length;
  }

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId     = this.route.snapshot.paramMap.get('unitId')     ?? '';
    this.isReadOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';

    this.unitsService.getBuildingsWithUnits()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(buildings => {
        this.building = buildings.find(b => b.id === this.buildingId);
        this.unit     = this.building?.units.find(u => u.id === this.unitId);
        const lang = this.translate.currentLang || 'ar';
        this.pageBreadcrumbTrail.set([
          { label: this.unit?.title ?? '', translate: false, route: ['/', lang, 'd3', 'unit-review', this.buildingId, this.unitId] }
        ]);
      });

    if (this.unitId) {
      this.unitsService.getUnitById(this.unitId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(detail => { this.unitDetail = detail; });
    }

    if (this.unitId) {
      this.isLoading = true;
      this.unitsService.getUnitAccess(this.unitId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (data) => {
            this.accessData   = data;
            this.accessPhotos = data.photos.map(p => ({
              category:          p.category,
              image:             p.imageUrl,
              titleKey:          CATEGORY_MAP[p.category]?.titleKey ?? p.category,
              tagKey:            CATEGORY_MAP[p.category]?.tagKey   ?? '',
              decision:          this.mapApiPhotoDecision(p.decision),
              rejectionReason:   p.rejectionReason ?? '',
              canReview:         this.canReviewPhoto(p.decision),
            }));
            this.isLoading = false;
          },
          error: () => { this.isLoading = false; }
        });
    }
  }

  ngOnDestroy(): void {
    this.pageBreadcrumbTrail.clear();
  }

  setPhotoDecision(photo: AccessPhoto, decision: Exclude<AccessPhotoDecision, 'pending'>): void {
    this.hasStartedReview = true;
    photo.decision = decision;
    if (decision === 'approved') {
      photo.rejectionReason = '';
    }
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.unitId) return;
    const isApprove = decision === 'approved';

    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:   isApprove ? 'd3.unitReview.confirm.accessApproveTitle'   : 'd3.unitReview.confirm.accessRejectTitle',
        messageKey: isApprove ? 'd3.unitReview.confirm.accessApproveMessage' : 'd3.unitReview.confirm.accessRejectMessage',
        confirmKey: isApprove ? 'd3.unitReview.confirm.approveAction'        : 'd3.unitReview.confirm.rejectAction',
        tone: isApprove ? 'approve' : 'reject'
      }
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(confirmed => {
        if (!confirmed) return;
        const apiDecision    = isApprove ? 'Approved' : 'Rejected';
        const rejectionReason = isApprove ? null : (this.rejectionNote.trim() || null);

        const photos = this.accessPhotos.map(p => ({
          category:        p.category,
          decision:        p.decision === 'approved' ? 'Approved' : 'Rejected',
          rejectionReason: p.decision === 'rejected' ? (p.rejectionReason.trim() || null) : null,
        }));

        this.unitsService.reviewUnitAccess(this.unitId, { decision: apiDecision, rejectionReason, photos })
          .subscribe({
            next: () => {
              if (this.buildingId) {
                this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'access', decision);
              }
              this.onBack();
            }
          });
      });
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  private mapApiPhotoDecision(decision: string | null | undefined): AccessPhotoDecision {
    const normalized = decision?.trim().toLowerCase() ?? 'pending';
    if (normalized === 'approved') return 'approved';
    if (normalized === 'rejected') return 'rejected';
    return 'pending';
  }

  private canReviewPhoto(decision: string | null | undefined): boolean {
    return this.mapApiPhotoDecision(decision) !== 'approved';
  }
}
