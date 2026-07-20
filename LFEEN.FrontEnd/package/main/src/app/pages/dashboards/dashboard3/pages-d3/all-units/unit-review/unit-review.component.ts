import { Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
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
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { PageTitleOverrideService } from '../../../services/page-title-override.service';

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
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule, DashboardLoadingComponent],
  templateUrl: './unit-review.component.html',
  styleUrl: './unit-review.component.scss'
})
export class UnitReviewComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageTitleOverride = inject(PageTitleOverrideService);
  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  unitDetail: UnitApiDetailItem | undefined;

  finalNotes = '';
  buildingId = '';
  unitId = '';
  reviewDecisions: Record<string, UnitReviewDecision> = {};
  isLoading = false;
  private forcedViewOnly = false;

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

  // The page is closed for review only once the unit has a final decision.
  // Anything else (Pending, PendingUpdate, HasPendingChanges, PendingAfterRejection)
  // must stay open for review, regardless of which tab/link got you here.
  get isViewMode(): boolean {
    const status = this.unitDetail?.overallStatus?.trim();
    return this.forcedViewOnly || status === 'Approved' || status === 'Rejected';
  }

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId     = this.route.snapshot.paramMap.get('unitId') ?? '';
    this.forcedViewOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';

    this.isLoading = true;
    this.unitsService.getUnitById(this.unitId).subscribe({
      next: data => {
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
          district:    data.district,
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
        this.pageTitleOverride.set(this.unit.title);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });

    this.unitsService.getReviewDecisions().subscribe(decisions => {
      this.reviewDecisions = decisions;
    });
  }

  ngOnDestroy(): void {
    this.pageTitleOverride.clear();
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

  // Final notes are optional on approval, but required on rejection.
  get isApproveDisabled(): boolean {
    if (!this.allSectionsDecided) return true;
    if (this.hasAnyRejectedSection) return true;
    return false;
  }

  get isRejectDisabled(): boolean {
    if (!this.allSectionsDecided) return true;
    return !this.finalNotes?.trim();
  }

  onBack(): void {
    this.router.navigate(['../../../units'], { relativeTo: this.route });
  }

  onApprove(): void {
    if (this.isApproveDisabled) return;
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
          .subscribe({
            next: () => {
              this.unitsService.setTab('published');
              this.onBack();
            }
          });
      });
  }

  onReject(): void {
    if (this.isRejectDisabled) return;
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

  // A section counts as "decided" only on a final Approved/Rejected decision.
  // getSectionDecision() already returns undefined for Pending/PendingUpdate/
  // HasPendingChanges/PendingAfterRejection, so this needs no extra status check.
  isSectionDecided(sectionKey: string): boolean {
    return !!this.getSectionDecision(sectionKey);
  }

  shouldShowReviewButtonLabel(sectionKey: string): boolean {
    return !this.isSectionDecided(sectionKey);
  }

  shouldOpenSectionInViewMode(sectionKey: string): boolean {
    return this.isViewMode || this.isSectionApproved(sectionKey);
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