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
import { PageBreadcrumbTrailService } from '../../../services/page-breadcrumb-trail.service';

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
  private readonly pageBreadcrumbTrail = inject(PageBreadcrumbTrailService);
  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  unitDetail: UnitApiDetailItem | undefined;

  finalNotes = '';
  buildingId = '';
  unitId = '';
  reviewDecisions: Record<string, UnitReviewDecision> = {};
  isLoading = false;
  private forcedViewOnly = false;
  private originTab = '';

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

  // Computed from reviewableSections rather than the backend's completedSections/
  // totalSections, because those count informational-only sections (smartLock, and
  // deposit when hasSecurityDeposit=false) toward the total without ever marking them
  // "completed" — that mismatch is what made the header progress ("8 of 9") disagree
  // with the final-review tally ("7 approved") for units with a non-applicable deposit.
  get completedCount(): number {
    return this.approvedCount + this.rejectedCount;
  }

  get totalCount(): number {
    return this.reviewableSections.length;
  }

  get progressPercent(): number {
    return this.totalCount > 0 ? Math.round((this.completedCount / this.totalCount) * 100) : 0;
  }

  // The header badge must reflect the unit's actual overallStatus, not the tab
  // you navigated from — otherwise a Draft/Approved unit opened for viewing
  // still shows "under admin review". But 'Draft' (status=0) and 'new' (status=1)
  // units both come back from the single-unit API with the literal overallStatus
  // 'Pending' — there's no distinct backend value for Draft yet (same gap noted
  // in units.service.ts/getAllUnitPages) — so overallStatus alone can't tell a
  // never-submitted Draft apart from a unit genuinely awaiting its first review.
  // originTab (the ?tab= query param the unit lists pass along) disambiguates them.
  get headerStatusConfig(): { labelKey: string; icon: string; mod: string } {
    const status = this.unitDetail?.overallStatus?.trim();
    // overallStatus flips to 'Approved' as soon as every section is approved, but the
    // unit isn't actually live until the final approval action is submitted (isDisplayed).
    // Labeling that in-between state "Approved" reads as done when it isn't yet.
    if (status === 'Approved' && !this.unitDetail?.isDisplayed) {
      return { labelKey: 'd3.unitReview.status.readyToPublish', icon: 'circle-check', mod: 'approved' };
    }
    // Approved *and* live — the final approval action has been submitted, so the unit is
    // adopted, not merely "accepted" section-by-section (the section badges keep that wording).
    if (status === 'Approved') return { labelKey: 'd3.unitReview.status.adopted', icon: 'circle-check', mod: 'approved' };
    if (status === 'Rejected') return { labelKey: 'd3.unitReview.status.rejected', icon: 'circle-x',     mod: 'rejected' };
    if (this.originTab === 'draft' || !status) {
      return { labelKey: 'd3.unitReview.status.draftLabel', icon: 'file-text', mod: 'draft' };
    }
    if (this.originTab === 'new') {
      return { labelKey: 'd3.unitReview.status.newLabel', icon: 'file-text', mod: 'pending' };
    }
    return { labelKey: 'd3.unitReview.status.adminReviewLabel', icon: 'clock', mod: 'pending' };
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
    this.originTab = this.route.snapshot.queryParamMap.get('tab') ?? '';

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
        // Fixed "Unit" crumb between the generic "review requests" entry link and the
        // unit's own title, so the breadcrumb reads as entity-type then entity-name
        // instead of jumping straight from the generic entry link to the unit's name.
        this.pageBreadcrumbTrail.set([{ label: 'd3.unitReview.unitCrumbLabel', translate: true }]);
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
    this.pageBreadcrumbTrail.clear();
  }

  // Some unit types (e.g. private hospitality facilities) don't require a license at
  // all, in which case the API sends licenseSection as null and licenseApplicable as
  // false. Drop it from the review flow entirely instead of showing a section that
  // will never be decided. depositSection is null the same way, for units whose setup
  // doesn't have a deposit section at all.
  get visibleSections(): UnitReviewSection[] {
    return this.reviewSections.filter(s => {
      if (s.key === 'license') return !this.unitDetail || this.unitDetail.licenseApplicable;
      if (s.key === 'deposit') return !this.unitDetail || !!this.unitDetail.depositSection;
      return true;
    });
  }

  // hasSecurityDeposit=false means a deposit isn't required for this unit — the section
  // stays visible but, like smartLock, is shown as an informational badge instead of a
  // decision the reviewer has to approve/reject.
  get isDepositInformational(): boolean {
    return !!this.unitDetail && !!this.unitDetail.depositSection && !this.unitDetail.hasSecurityDeposit;
  }

  isInformationalSection(section: UnitReviewSection): boolean {
    if (section.isSmartLockBadge) return true;
    if (section.key === 'deposit') return this.isDepositInformational;
    return false;
  }

  infoBadgeKey(section: UnitReviewSection): string {
    return `d3.unitReview.sections.${section.key}.infoBadge`;
  }

  readonly activeBadgeKey = 'd3.unitReview.sections.smartLock.activeBadge';

  get reviewableSections(): UnitReviewSection[] {
    return this.visibleSections.filter(s => !this.isInformationalSection(s));
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

  // True once the unit is live AND finally approved with nothing pending. In this
  // state there's nothing left to approve, so the approve button is hidden entirely
  // and the final-notes block only stays visible when there's actually a note.
  get isFinalApproved(): boolean {
    return !!this.unitDetail?.isDisplayed
      && this.unitDetail?.overallStatus?.trim() === 'Approved';
  }

  // The approve button is rendered unless the unit is already finally approved.
  // Otherwise the backend's canFinalApprove flag is the source of truth for whether
  // it's enabled — it already accounts for every section (including access photos)
  // being decided with no rejections.
  get isApproveDisabled(): boolean {
    return !this.unitDetail?.canFinalApprove;
  }

  // A rejected section is grounds to reject the whole unit right away —
  // no need to wait until every other section has been reviewed too.
  get isRejectDisabled(): boolean {
    if (!this.hasAnyRejectedSection && !this.allSectionsDecided) return true;
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
      // The "access" card covers both the access instructions and the access photos,
      // which the backend tracks as two separate sections reviewed together. If the
      // photos were re-uploaded after the instructions were approved, accessPhotosSection
      // flips back to Pending on its own — so the card must stay "pending" (re-reviewable)
      // until BOTH are approved, otherwise the reviewer can't clear it and canFinalApprove
      // never turns true.
      case 'access': {
        const instr  = d.accessSection.decision;
        // Recent API responses combine the access instructions and photos into
        // accessSection and omit accessPhotosSection. When the separate section
        // is present, keep requiring both decisions as before.
        const photos = d.accessPhotosSection?.decision ?? instr;
        if (instr === 'Rejected' || photos === 'Rejected') return 'Rejected';
        if (instr === 'Approved' && photos === 'Approved')  return 'Approved';
        return 'Pending';
      }
      case 'cancelPolicy': return d.cancellationPolicySection.decision;
      // depositSection is null when the unit's type/business setup doesn't have a
      // deposit section at all (as opposed to Pending, which means it's undecided).
      case 'deposit':      return d.depositSection?.decision ?? 'Pending';
      case 'services':     return d.servicesSection.decision;
      // licenseSection is null when the unit's type/business setup doesn't require a
      // license at all (as opposed to Pending, which means it's required but undecided).
      case 'license':      return d.licenseSection?.decision ?? 'Pending';
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
      case 'deposit':      return d.depositSection?.description ?? '';
      case 'services':     return d.servicesSection.description ?? '';
      case 'license':      return d.licenseSection?.description ?? '';
      default:             return '';
    }
  }

  private mapApiDecision(decision: string): UnitReviewDecision | undefined {
    if (decision === 'Approved') return 'approved';
    if (decision === 'Rejected') return 'rejected';
    return undefined;
  }
}
