import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { ReviewConfirmDialogComponent } from '../../build-review/review-confirm-dialog/review-confirm-dialog.component';
import { UnitReviewDecision, UnitsService } from '../../../services/units.service';
import { BuildingWithUnits, UnitApiDetailItem, UnitCardItem } from '../../../interfaces/unit-card.model';

interface UnitReviewSection {
  key: string;
  titleKey: string;
  descKey: string;
  icon: string;
  isSmartLockBadge: boolean;
  reviewBtnKey?: string;
}

@Component({
  selector: 'app-unit-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule],
  templateUrl: './unit-review.component.html',
  styleUrl: './unit-review.component.scss'
})
export class UnitReviewComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  unitDetail: UnitApiDetailItem | undefined;

  finalNotes = '';
  buildingId = '';
  unitId = '';
  reviewDecisions: Record<string, UnitReviewDecision> = {};
  viewModeFromParam = false;

  readonly reviewSections: UnitReviewSection[] = [
    { key: 'basicInfo',    titleKey: 'd3.unitReview.sections.basicInfo.title',    descKey: 'd3.unitReview.sections.basicInfo.desc',    icon: 'home',             isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.basicInfo.btn'    },
    { key: 'photos',       titleKey: 'd3.unitReview.sections.photos.title',       descKey: 'd3.unitReview.sections.photos.desc',       icon: 'photo',            isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.photos.btn'       },
    { key: 'terms',        titleKey: 'd3.unitReview.sections.terms.title',        descKey: 'd3.unitReview.sections.terms.desc',        icon: 'file-text',        isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.terms.btn'        },
    { key: 'pricing',      titleKey: 'd3.unitReview.sections.pricing.title',      descKey: 'd3.unitReview.sections.pricing.desc',      icon: 'currency-dollar',  isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.pricing.btn'      },
    { key: 'smartLock',    titleKey: 'd3.unitReview.sections.smartLock.title',    descKey: 'd3.unitReview.sections.smartLock.desc',    icon: 'lock',             isSmartLockBadge: true                                                               },
    { key: 'access',       titleKey: 'd3.unitReview.sections.access.title',       descKey: 'd3.unitReview.sections.access.desc',       icon: 'map-pin',          isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.access.btn'       },
    { key: 'cancelPolicy', titleKey: 'd3.unitReview.sections.cancelPolicy.title', descKey: 'd3.unitReview.sections.cancelPolicy.desc', icon: 'calendar-event',   isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.cancelPolicy.btn' },
    { key: 'deposit',      titleKey: 'd3.unitReview.sections.deposit.title',      descKey: 'd3.unitReview.sections.deposit.desc',      icon: 'shield-check',     isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.deposit.btn'      },
    { key: 'services',     titleKey: 'd3.unitReview.sections.services.title',     descKey: 'd3.unitReview.sections.services.desc',     icon: 'settings',         isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.services.btn'     },
    { key: 'license',      titleKey: 'd3.unitReview.sections.license.title',      descKey: 'd3.unitReview.sections.license.desc',      icon: 'certificate',      isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.license.btn'      }
  ];

  get completedCount(): number {
    return this.unitDetail?.completedSections ?? 0;
  }

  get totalCount(): number {
    return this.unitDetail?.totalSections ?? this.reviewSections.length;
  }

  get progressPercent(): number {
    return this.unitDetail?.progressPercentage ?? 0;
  }

  get needsReReview(): boolean {
    const status = this.unitDetail?.overallStatus?.trim();
    return status === 'PendingUpdate' || status === 'HasPendingChanges';
  }

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

  get isViewMode(): boolean {
    const status = this.unitDetail?.overallStatus?.trim();
    if (status === 'HasPendingChanges') return false;
    if (this.viewModeFromParam) return true;
    return status === 'Approved' || status === 'Rejected';
  }

  ngOnInit(): void {
    this.buildingId       = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId           = this.route.snapshot.paramMap.get('unitId') ?? '';
    this.viewModeFromParam = this.route.snapshot.queryParamMap.get('mode') === 'view';

    this.unitsService.getUnitById(this.unitId).subscribe(data => {
      this.unitDetail = data;
      this.finalNotes = data.finalNotes ?? '';
      this.unit = {
        id:          String(data.unitId),
        unitNumber:  String(data.apartmentNumberInFloor),
        title:       data.name ?? `${data.unitTypeName} ${data.apartmentNumberInFloor}`,
        floor:       String(data.floorNumber),
        capacity:    String(data.maxGuests),
        status:      'underReview',
        type:        data.unitTypeName,
        description: '',
        rooms:       0,
        hasPool:     false
      };
      this.building = {
        id:             String(data.propertyId),
        name:           data.propertyName,
        location:       data.propertyName,
        publishedUnits: 0,
        image:          data.mainPhotoUrl ?? 'assets/images/products/review_image.png',
        units:          []
      };
    });

    this.unitsService.getReviewDecisions().subscribe(decisions => {
      this.reviewDecisions = decisions;
    });
  }

  get reviewableSections(): UnitReviewSection[] {
    return this.reviewSections.filter(s => !s.isSmartLockBadge);
  }

  get approvedCount(): number {
    return this.reviewableSections.filter(s => this.isSectionApproved(s.key)).length;
  }

  get rejectedCount(): number {
    return this.reviewableSections.filter(s => this.isSectionRejected(s.key)).length;
  }

  get pendingCount(): number {
    return this.reviewableSections.filter(s => !this.isSectionApproved(s.key) && !this.isSectionRejected(s.key)).length;
  }

  get hasAnyRejectedSection(): boolean {
    return this.rejectedCount > 0;
  }

  get allSectionsDecided(): boolean {
    return this.pendingCount === 0;
  }

  onBack(): void {
    this.router.navigate(['../../../units'], { relativeTo: this.route });
  }

  onApprove(): void {
    if (this.hasAnyRejectedSection) return;
    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:   'd3.unitReview.confirm.finalApproveTitle',
        messageKey: 'd3.unitReview.confirm.finalApproveMessage',
        confirmKey: 'd3.unitReview.confirm.approveAction',
        tone: 'approve'
      }
    });
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.unitsService.approveUnit(this.unitId, this.finalNotes)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({ next: () => this.onBack() });
      });
  }

  onReject(): void {
    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:   'd3.unitReview.confirm.finalRejectTitle',
        messageKey: 'd3.unitReview.confirm.finalRejectMessage',
        confirmKey: 'd3.unitReview.confirm.rejectAction',
        tone: 'reject'
      }
    });
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.unitsService.rejectUnit(this.unitId, this.finalNotes)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({ next: () => this.onBack() });
      });
  }

  onReviewSection(section: UnitReviewSection): void {
    const extras = {
      relativeTo: this.route,
      ...(this.shouldOpenSectionInViewMode(section.key) ? { queryParams: { mode: 'view' } } : {})
    };

    const routeMap: Record<string, string> = {
      basicInfo:    'basic-info',
      photos:       'photos',
      terms:        'terms',
      pricing:      'pricing',
      access:       'access',
      cancelPolicy: 'cancel-policy',
      deposit:      'deposit',
      services:     'services',
      license:      'license',
    };

    const path = routeMap[section.key];
    if (path) this.router.navigate([path], extras);
  }

  getSectionDecision(sectionKey: string): UnitReviewDecision | undefined {
    if (this.unitDetail) {
      return this.mapApiDecision(this.getApiSectionDecision(sectionKey));
    }
    if (!this.buildingId || !this.unitId) return undefined;
    return this.unitsService.getReviewDecision(this.buildingId, this.unitId, sectionKey);
  }

  isSectionApproved(sectionKey: string): boolean {
    return this.getSectionDecision(sectionKey) === 'approved';
  }

  isSectionRejected(sectionKey: string): boolean {
    return this.getSectionDecision(sectionKey) === 'rejected';
  }

  isSectionDecided(sectionKey: string): boolean {
    return !this.needsReReview && !!this.getSectionDecision(sectionKey);
  }

  shouldShowReviewButtonLabel(sectionKey: string): boolean {
    return !this.isSectionDecided(sectionKey);
  }

  shouldOpenSectionInViewMode(sectionKey: string): boolean {
    return this.isSectionApproved(sectionKey) && !this.needsReReview;
  }

  private getApiSectionDecision(sectionKey: string): string {
    const d = this.unitDetail!;
    switch (sectionKey) {
      case 'basicInfo':    return d.basicDataSection.decision;
      case 'photos':       return d.photosSection.decision;
      case 'terms':        return d.termsSection.decision;
      case 'pricing':      return d.pricingSection.decision;
      case 'access':       return d.accessSection.decision;
      case 'cancelPolicy': return d.cancellationPolicySection.decision;
      case 'deposit':      return d.depositSection.decision;
      case 'services':     return d.servicesSection.decision;
      case 'license':      return d.licenseSection.decision;
      default:             return 'Pending';
    }
  }

  getSectionDescription(sectionKey: string): string {
    if (!this.unitDetail) return '';
    const d = this.unitDetail;
    switch (sectionKey) {
      case 'basicInfo':    return d.basicDataSection.description ?? '';
      case 'photos':       return d.photosSection.description ?? '';
      case 'terms':        return d.termsSection.description ?? '';
      case 'pricing':      return d.pricingSection.description ?? '';
      case 'access':       return d.accessSection.description ?? '';
      case 'cancelPolicy': return d.cancellationPolicySection.description ?? '';
      case 'deposit':      return d.depositSection.description ?? '';
      case 'services':     return d.servicesSection.description ?? '';
      case 'license':      return d.licenseSection.description ?? '';
      default:             return '';
    }
  }

  private mapApiDecision(decision: string): UnitReviewDecision | undefined {
    if (decision === 'Approved') return 'approved';
    if (decision === 'Rejected') return 'rejected';
    return undefined;
  }
}
