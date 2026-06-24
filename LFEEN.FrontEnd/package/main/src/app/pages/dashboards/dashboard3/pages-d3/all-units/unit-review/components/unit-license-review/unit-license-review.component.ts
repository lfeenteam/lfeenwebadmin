import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { ReviewConfirmDialogComponent } from '../../../../build-review/review-confirm-dialog/review-confirm-dialog.component';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';
import { UnitLicenseResponse } from '../../../../../interfaces/unit-card.model';

interface LicenseDetailItem {
  labelKey: string;
  value: string | null;
  badgeKey?: string;
  showBadge?: boolean;
  wide?: boolean;
}

@Component({
  selector: 'app-unit-license-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule],
  templateUrl: './unit-license-review.component.html',
  styleUrl: './unit-license-review.component.scss'
})
export class UnitLicenseReviewComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer  = inject(DomSanitizer);

  buildingId  = '';
  unitId      = '';
  rejectionNote = '';
  license: UnitLicenseResponse | null = null;
  isLoading   = false;
  isReadOnly  = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unitsService: UnitsService,
    private translate: TranslateService,
    private dialog: MatDialog
  ) {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {});
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get safeDocumentUrl(): SafeResourceUrl | null {
    if (!this.license?.licenseAttachmentUrl) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.license.licenseAttachmentUrl);
  }

  get ownerInitial(): string {
    return (this.license?.accountName ?? 'H').charAt(0).toUpperCase();
  }

  get licenseDetails(): LicenseDetailItem[] {
    const l = this.license;
    return [
      {
        labelKey: 'd3.unitReview.licenseView.details.numberLabel',
        value: l?.licenseNumber ?? null,
        badgeKey: 'd3.unitReview.licenseView.details.verifiedBadge',
        showBadge: !!l?.licenseNumber
      },
      {
        labelKey: 'd3.unitReview.licenseView.details.statusLabel',
        value: l?.licenseStatusName ?? l?.documentStatusName ?? l?.documentStatus ?? null
      },
      {
        labelKey: 'd3.unitReview.licenseView.details.issueDateLabel',
        value: l?.issueDate ? new Date(l.issueDate).toLocaleDateString() : null
      },
      {
        labelKey: 'd3.unitReview.licenseView.details.expiryDateLabel',
        value: l?.expiryDate ? new Date(l.expiryDate).toLocaleDateString() : null
      },
      {
        labelKey: 'd3.unitReview.licenseView.details.sourceLabel',
        value: l?.licenseTypeName ?? l?.licenseType ?? null,
        wide: true
      },
      {
        labelKey: 'd3.unitReview.licenseView.details.categoryLabel',
        value: l?.classification ?? null,
        wide: true
      }
    ];
  }

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId     = this.route.snapshot.paramMap.get('unitId')     ?? '';
    this.isReadOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';

    if (!this.unitId) return;
    this.isLoading = true;
    this.unitsService.getUnitLicense(this.unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  (data) => { this.license = data; this.isLoading = false; },
        error: ()     => { this.isLoading = false; }
      });
  }

  openDocument(): void {
    const url = this.license?.licenseAttachmentUrl;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.unitId) return;
    const isApprove = decision === 'approved';

    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:   isApprove ? 'd3.unitReview.confirm.licenseApproveTitle'   : 'd3.unitReview.confirm.licenseRejectTitle',
        messageKey: isApprove ? 'd3.unitReview.confirm.licenseApproveMessage' : 'd3.unitReview.confirm.licenseRejectMessage',
        confirmKey: isApprove ? 'd3.unitReview.confirm.approveAction'         : 'd3.unitReview.confirm.rejectAction',
        tone: isApprove ? 'approve' : 'reject'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      const apiDecision     = isApprove ? 'Approved' : 'Rejected';
      const rejectionReason = isApprove ? null : (this.rejectionNote.trim() || null);

      this.unitsService.reviewUnitLicense(this.unitId, apiDecision, rejectionReason)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            if (this.buildingId) {
              this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'license', decision);
            }
            this.onBack();
          }
        });
    });
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
