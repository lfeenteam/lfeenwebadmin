import { Component, DestroyRef, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ReviewImageComponent } from './review-image/review-image.component';
import { ReviewTermsComponent } from './review-terms/review-terms.component';
import { ReviewLicenseComponent } from './review-license/review-license.component';
import { ReviewBasicInfoComponent } from './review-basic-info/review-basic-info.component';
import { ReviewLocationComponent } from './review-location/review-location.component';
import { ActivatedRoute, Router } from '@angular/router';
import { BuildingReviewService } from '../../services/building-review.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BuildingReviewInfo, SectionDecisionStatus, SectionReviewResponse } from '../../interfaces/building-card.model';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { ReviewConfirmDialogComponent } from './review-confirm-dialog/review-confirm-dialog.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageBackOverrideService } from '../../services/page-back-override.service';
import { PageTitleOverrideService } from '../../services/page-title-override.service';
import { PageBreadcrumbTrailService } from '../../services/page-breadcrumb-trail.service';

type SectionView = 'list' | 'basicInfo' | 'images' | 'location' | 'terms' | 'license' | 'final';

@Component({
  selector: 'app-build-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, ReviewImageComponent, ReviewTermsComponent, ReviewLicenseComponent, ReviewBasicInfoComponent, ReviewLocationComponent, TranslateModule],
  templateUrl: './build-review.component.html',
  styleUrl: './build-review.component.scss'
})
export class BuildReviewComponent implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);
  private pageBackOverride = inject(PageBackOverrideService);
  private pageTitleOverride = inject(PageTitleOverrideService);
  private pageBreadcrumbTrail = inject(PageBreadcrumbTrailService);
  private readonly sectionTitleKeys: Record<string, string> = {
    basicInfo: 'd3.buildReview.sections.basicInfoTitle',
    images:    'd3.buildReview.sections.photosTitle',
    location:  'd3.buildReview.sections.locationTitle',
    terms:     'd3.buildReview.sections.termsTitle',
    license:   'd3.buildReview.sections.licenseTitle',
  };
  private readonly validSectionViews: SectionView[] =
    ['basicInfo', 'images', 'location', 'terms', 'license', 'final'];

  private readonly backHandler = () => {
    if (this.currentView === 'list') return false;
    this.setView('list');
    return true;
  };

  currentView: SectionView = 'list';
  buildingId: string | null = null;
  imageError = false;
  orgLogoError = false;
  overallStatus = '';
  private forcedViewOnly = false;

  building: BuildingReviewInfo = {
    id: '',
    name: '',
    location: '',
    organization: '',
    organizationLogoUrl: null,
    totalUnits: '0',
    imageUrl: 'assets/images/building.jpg',
    propertyTypeName: '',
    businessType: '',
    region: '',
    city: '',
    district: '',
    streetName: '',
    buildingNumber: '',
    postalCode: '',
    latitude: null,
    longitude: null
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private buildingService: BuildingReviewService,
    private toastr: ToastrService,
    private translate: TranslateService,
    private dialog: MatDialog
  ) {}

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('id');
    this.forcedViewOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';

    const sectionParam = this.route.snapshot.queryParamMap.get('section') as SectionView | null;
    if (sectionParam && this.validSectionViews.includes(sectionParam)) {
      this.currentView = sectionParam;
    }

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadProperty());

    this.loadProperty();
    this.pageBackOverride.set(this.backHandler);
  }

  // Keeps the open section in the URL so a browser reload lands back on the
  // same section instead of resetting to the list view.
  private setView(view: SectionView): void {
    this.currentView = view;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: view === 'list' ? null : view },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.updateHeaderForView();
  }

  ngOnDestroy(): void {
    this.pageBackOverride.clear(this.backHandler);
    this.pageTitleOverride.clear();
    this.pageBreadcrumbTrail.clear();
  }

  // Building review's sections aren't separate routes (just internal currentView toggles),
  // so the shared header can't derive title/breadcrumb from route data here. We push them
  // manually: at the section list, H1 = building name; inside a section, H1 = section name
  // and the building name becomes a clickable breadcrumb crumb back to the section list.
  private updateHeaderForView(): void {
    const sectionKey = this.sectionTitleKeys[this.currentView];
    if (!sectionKey) {
      this.pageTitleOverride.set(this.building.name);
      this.pageBreadcrumbTrail.clear();
      return;
    }
    this.pageTitleOverride.set(this.translate.instant(sectionKey));
    this.pageBreadcrumbTrail.set([
      { label: this.building.name, translate: false, onClick: () => this.setView('list') }
    ]);
  }

  private loadProperty(): void {
    if (this.buildingId) {
      this.imageError = false;
      this.orgLogoError = false;
      this.buildingService.getPropertyById(this.buildingId).subscribe(data => {
        this.building = {
          id:                  data.externalId,
          name:                data.name,
          location:            data.formattedAddress || [data.city, data.district].filter(Boolean).join(' - '),
          organization:        data.accountName ?? '',
          organizationLogoUrl: data.accountLogoUrl,
          totalUnits:          String(data.totalUnits),
          imageUrl:            data.mainPhotoUrl ?? 'assets/images/building.jpg',
          propertyTypeName:    data.propertyTypeName ?? '',
          businessType:        data.businessType ?? '',
          region:              data.region ?? '',
          city:                data.city ?? '',
          district:            data.district ?? '',
          streetName:          data.streetName ?? '',
          buildingNumber:      data.buildingNumber ?? '',
          postalCode:          data.postalCode ?? '',
          latitude:            data.latitude,
          longitude:           data.longitude
        };
        this.updateHeaderForView();
        this.overallStatus = data.overallStatus?.trim() ?? '';

        this.reviewSections[1].completed = this.isFinalDecision(data.photosSection.decision);
        this.reviewSections[1].status    = this.mapDecision(data.photosSection.decision);
        if (data.photosSection.rejectionReason) {
          this.reviewSections[1].notes = data.photosSection.rejectionReason;
        }

        this.reviewSections[3].completed = this.isFinalDecision(data.termsSection.decision);
        this.reviewSections[3].status    = this.mapDecision(data.termsSection.decision);
        if (data.termsSection.rejectionReason) {
          this.reviewSections[3].notes = data.termsSection.rejectionReason;
        }

        this.reviewSections[4].completed = this.isFinalDecision(data.licenseSection.decision);
        this.reviewSections[4].status    = this.mapDecision(data.licenseSection.decision);
        if (data.licenseSection.rejectionReason) {
          this.reviewSections[4].notes = data.licenseSection.rejectionReason;
        }

        this.reviewSections[0].completed = this.isFinalDecision(data.basicDataSection.decision);
        this.reviewSections[0].status    = this.mapDecision(data.basicDataSection.decision);
        if (data.basicDataSection.rejectionReason) {
          this.reviewSections[0].notes = data.basicDataSection.rejectionReason;
        }

        this.reviewSections[2].completed = this.isFinalDecision(data.locationSection.decision);
        this.reviewSections[2].status    = this.mapDecision(data.locationSection.decision);
        if (data.locationSection.rejectionReason) {
          this.reviewSections[2].notes = data.locationSection.rejectionReason;
        }
      });
    }
  }

  // A section is only "done" once it has a final decision. Anything else
  // (Pending, or PendingUpdate after the host edits an already-decided section)
  // must stay open for review.
  private isFinalDecision(decision: SectionDecisionStatus): boolean {
    return decision === 'Approved' || decision === 'Rejected';
  }

  private mapDecision(decision: SectionDecisionStatus): 'pending' | 'accepted' | 'rejected' {
    switch (decision) {
      case 'Approved': return 'accepted';
      case 'Rejected': return 'rejected';
      default:         return 'pending';
    }
  }

  reviewSections: {
    iconUrl?: string;
    tablerIcon?: string;
    titleKey: string;
    completed: boolean;
    status: 'pending' | 'accepted' | 'rejected';
    notes: string;
  }[] = [
    {
      tablerIcon: 'clipboard-list',
      titleKey:   'd3.buildReview.sections.basicInfoTitle',
      completed:  false,
      status:     'pending',
      notes:      ''
    },
    {
      iconUrl:   'assets/images/svgs/SVG.svg',
      titleKey:  'd3.buildReview.sections.photosTitle',
      completed: false,
      status:    'pending',
      notes:     ''
    },
    {
      tablerIcon: 'map-pin',
      titleKey:   'd3.buildReview.sections.locationTitle',
      completed:  false,
      status:     'pending',
      notes:      ''
    },
    {
      iconUrl:   'assets/images/svgs/SVG (1).svg',
      titleKey:  'd3.buildReview.sections.termsTitle',
      completed: false,
      status:    'pending',
      notes:     ''
    },
    {
      iconUrl:   'assets/images/svgs/SVG (2).svg',
      titleKey:  'd3.buildReview.sections.licenseTitle',
      completed: false,
      status:    'pending',
      notes:     ''
    }
  ];

  finalRejectionNotes = '';
  finalNotes = '';
  isFinalSubmitting = false;
  showSuccessModal = false;

  get completedCount(): number {
    return this.reviewSections.filter(s => s.completed).length;
  }

  get progressPercent(): number {
    return Math.round((this.completedCount / this.reviewSections.length) * 100);
  }

  get allSectionsComplete(): boolean {
    return this.reviewSections.every(s => s.completed);
  }

  get viewOnly(): boolean {
    return this.forcedViewOnly || this.overallStatus === 'Approved' || this.overallStatus === 'Rejected';
  }

  get isImagesReadOnly(): boolean {
    return this.reviewSections[1].completed;
  }

  get canReject(): boolean {
    return !this.viewOnly && this.allSectionsComplete;
  }

  get canApprove(): boolean {
    return !this.viewOnly && this.allSectionsComplete;
  }

  openSection(index: number): void {
    const views: SectionView[] =
      ['basicInfo', 'images', 'location', 'terms', 'license'];
    this.setView(views[index]);
  }

  onBack(): void {
    if (this.currentView === 'list') {
      this.router.navigate(['../../buildings'], { relativeTo: this.route });
    } else {
      this.setView('list');
    }
  }

  onSectionApproved(index: number, result?: SectionReviewResponse): void {
    const hasRejection = result?.decision === 'Rejected';
    this.reviewSections[index].completed = true;
    this.reviewSections[index].status    = hasRejection ? 'rejected' : 'accepted';
    this.setView('list');
  }

  get isFinalSuccess(): boolean {
    return this.reviewSections.every(s => s.status === 'accepted');
  }

  get rejectedSectionsSummary() {
    return this.reviewSections.filter(s => s.status === 'rejected');
  }

  onReject(): void {
    if (!this.canReject || !this.buildingId || this.isFinalSubmitting) return;
    this.confirmFinalDecision('Rejected');
  }

  onApprove(): void {
    if (!this.canApprove || !this.isFinalSuccess || !this.buildingId || this.isFinalSubmitting) return;
    this.confirmFinalDecision('Approved');
  }

  private confirmFinalDecision(decision: 'Approved' | 'Rejected'): void {
    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey: decision === 'Approved'
          ? 'd3.buildReview.confirm.finalApproveTitle'
          : 'd3.buildReview.confirm.finalRejectTitle',
        messageKey: decision === 'Approved'
          ? 'd3.buildReview.confirm.finalApproveMessage'
          : 'd3.buildReview.confirm.finalRejectMessage',
        confirmKey: decision === 'Approved'
          ? 'd3.buildReview.confirm.approveAction'
          : 'd3.buildReview.confirm.rejectAction',
        tone: decision === 'Approved' ? 'approve' : 'reject'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) this.submitFinalDecision(decision);
    });
  }

  private submitFinalDecision(decision: 'Approved' | 'Rejected'): void {
    if (!this.buildingId) return;

    const payload = { finalNotes: this.finalNotes.trim() || null };
    const request = decision === 'Approved'
      ? this.buildingService.approveBuilding(this.buildingId, payload)
      : this.buildingService.rejectBuilding(this.buildingId, payload);

    this.isFinalSubmitting = true;
    request.subscribe({
      next: () => {
        this.isFinalSubmitting = false;
        if (decision === 'Approved') {
          this.showSuccessModal = true;
        } else {
          this.toastr.success(this.translate.instant('d3.buildReview.finalDecision.rejectSuccess'));
          this.router.navigate(['../../buildings'], { relativeTo: this.route });
        }
      },
      error: (err) => {
        this.isFinalSubmitting = false;
        const errorCode = err?.error?.code ?? err?.error?.errorCode;
        const keyByCode: Record<string, string> = {
          ALREADY_APPROVED: 'd3.buildReview.finalDecision.errors.alreadyApproved',
          ACCOUNT_NOT_APPROVED: 'd3.buildReview.finalDecision.errors.accountNotApproved',
          SECTIONS_NOT_ALL_APPROVED: 'd3.buildReview.finalDecision.errors.sectionsNotApproved',
          ALREADY_REJECTED: 'd3.buildReview.finalDecision.errors.alreadyRejected'
        };
        this.toastr.error(this.translate.instant(keyByCode[errorCode] ?? 'd3.toast.errorOp'));
      }
    });
  }

  goToUnits(): void {
    this.router.navigate(['../../units'], { relativeTo: this.route });
    this.showSuccessModal = false;
  }

  closeModal(): void {
    this.showSuccessModal = false;
    this.buildingService.setTab('published');
    this.router.navigate(['../../buildings'], { relativeTo: this.route });
  }
}
