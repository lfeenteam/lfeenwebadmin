import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ReviewImageComponent } from './review-image/review-image.component';
import { ReviewTermsComponent } from './review-terms/review-terms.component';
import { ReviewLicenseComponent } from './review-license/review-license.component';
import { ActivatedRoute, Router } from '@angular/router';
import { BuildingReviewService } from '../../services/building-review.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AdminReviewStatus, SectionReviewResponse } from '../../interfaces/building-card.model';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { ReviewConfirmDialogComponent } from './review-confirm-dialog/review-confirm-dialog.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-build-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, ReviewImageComponent, ReviewTermsComponent, ReviewLicenseComponent, TranslateModule],
  templateUrl: './build-review.component.html',
  styleUrl: './build-review.component.scss'
})
export class BuildReviewComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  currentView: 'list' | 'images' | 'terms' | 'license' | 'final' = 'list';
  buildingId: string | null = null;
  imageError = false;
  orgLogoError = false;
  viewOnly = false;
  overallStatus = '';

  building = {
    id: '',
    name: '',
    location: '',
    organization: '',
    organizationLogoUrl: null as string | null,
    totalUnits: '0',
    imageUrl: 'assets/images/building.jpg'
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
    this.viewOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadProperty());

    this.loadProperty();
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
          imageUrl:            data.mainPhotoUrl ?? 'assets/images/building.jpg'
        };
        this.overallStatus = data.overallStatus?.trim() ?? '';

        this.reviewSections[0].completed = data.photosSection.decision !== 'Pending';
        this.reviewSections[0].status    = this.mapDecision(data.photosSection.decision);
        if (data.photosSection.rejectionReason) {
          this.reviewSections[0].notes = data.photosSection.rejectionReason;
        }

        this.reviewSections[1].completed = data.termsSection.decision !== 'Pending';
        this.reviewSections[1].status    = this.mapDecision(data.termsSection.decision);
        if (data.termsSection.rejectionReason) {
          this.reviewSections[1].notes = data.termsSection.rejectionReason;
        }

        this.reviewSections[2].completed = data.licenseSection.decision !== 'Pending';
        this.reviewSections[2].status    = this.mapDecision(data.licenseSection.decision);
        if (data.licenseSection.rejectionReason) {
          this.reviewSections[2].notes = data.licenseSection.rejectionReason;
        }
      });
    }
  }

  private mapDecision(decision: AdminReviewStatus): 'pending' | 'accepted' | 'rejected' {
    switch (decision) {
      case 'Approved': return 'accepted';
      case 'Rejected': return 'rejected';
      default:         return 'pending';
    }
  }

  reviewSections = [
    {
      iconUrl:   'assets/images/svgs/SVG.svg',
      titleKey:  'd3.buildReview.sections.photosTitle',
      completed: false,
      status:    'pending',
      notes:     ''
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

  get hasPendingChanges(): boolean {
    return this.overallStatus === 'HasPendingChanges';
  }

  get isImagesReadOnly(): boolean {
    if (this.hasPendingChanges) return false;
    return this.reviewSections[0].completed;
  }

  get canReject(): boolean {
    return !this.viewOnly && this.allSectionsComplete;
  }

  get canApprove(): boolean {
    return !this.viewOnly && this.allSectionsComplete;
  }

  openSection(index: number): void {
    const views: ('images' | 'terms' | 'license')[] = ['images', 'terms', 'license'];
    if (index === 0 || this.reviewSections[index - 1].completed) {
      this.currentView = views[index];
    }
  }

  onBack(): void {
    if (this.currentView === 'list') {
      this.router.navigate(['../../buildings'], { relativeTo: this.route });
    } else {
      this.currentView = 'list';
    }
  }

  onSectionApproved(index: number, result?: SectionReviewResponse): void {
    const hasRejection = result?.decision === 'Rejected';
    this.reviewSections[index].completed = true;
    this.reviewSections[index].status    = hasRejection ? 'rejected' : 'accepted';
    this.currentView = 'list';
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
  }
}
