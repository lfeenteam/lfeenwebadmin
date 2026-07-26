import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BuildingReviewService } from '../../../services/building-review.service';
import {
  LicenseReviewPayload,
  LicenseReviewResponse,
  PropertyLicenseResponse
} from '../../../interfaces/building-card.model';
import { ReviewConfirmDialogComponent } from '../review-confirm-dialog/review-confirm-dialog.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReviewEmptyStateComponent } from 'src/app/components/dashboard3/review-empty-state/review-empty-state.component';

@Component({
  selector: 'app-review-license',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, FormsModule, TranslateModule, ReviewEmptyStateComponent],
  templateUrl: './review-license.component.html',
  styleUrl: './review-license.component.scss'
})
export class ReviewLicenseComponent implements OnInit {
  @Input() propertyId = '';
  @Input() readOnly = false;
  @Output() back = new EventEmitter<void>();
  @Output() approve = new EventEmitter<LicenseReviewResponse>();

  private buildingService = inject(BuildingReviewService);
  private toastr = inject(ToastrService);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(DomSanitizer);

  isLoading = false;
  isSubmitting = false;
  license: PropertyLicenseResponse | null = null;
  rejectionReason = '';

  // The attachment can be a PDF or an image; an <img> tag can't render a PDF (it 404s
  // the "error" handler even on a valid URL), so preview both through a sandboxed iframe.
  get safeDocumentUrl(): SafeResourceUrl | null {
    const url = this.license?.licenseAttachmentUrl;
    if (!url) return null;

    // For PDFs, the browser's built-in viewer otherwise renders its own toolbar and
    // grey page background around the document. These open-params (supported by
    // Chrome/Edge's native PDF viewer) hide that chrome and fit the page to width,
    // so it reads as a clean document instead of an embedded PDF viewer.
    const isPdf = /\.pdf(\?|#|$)/i.test(url);
    const src = isPdf ? `${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH` : url;
    return this.sanitizer.bypassSecurityTrustResourceUrl(src);
  }

  ngOnInit(): void {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadLicense());

    this.loadLicense();
  }

  private loadLicense(): void {
    if (!this.propertyId) return;

    this.isLoading = true;
    this.buildingService.getPropertyLicense(this.propertyId).subscribe({
      next: (data) => {
        this.isLoading = false;
        this.license = data;
        this.rejectionReason = data.rejectionReason ?? '';
      },
      error: () => {
        this.isLoading = false;
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
      }
    });
  }

  get isExpired(): boolean {
    if (!this.license?.expiryDate) return false;
    return new Date(this.license.expiryDate).getTime() < Date.now();
  }

  get hasLicenseDetails(): boolean {
    if (!this.license) return false;
    return Boolean(
      this.license.issueDate ||
      this.license.expiryDate ||
      this.license.licenseType ||
      this.license.facilityName ||
      this.license.classification ||
      this.license.licenseStatusName ||
      this.license.documentStatus
    );
  }

  get hasLicenseData(): boolean {
    if (!this.license) return false;
    return Boolean(
      this.license.licenseId ||
      this.license.licenseNumber ||
      this.license.licenseType ||
      this.license.licenseAttachmentUrl ||
      this.license.facilityName ||
      this.license.classification ||
      this.license.issueDate ||
      this.license.expiryDate ||
      this.license.licenseStatusName ||
      this.license.documentStatus
    );
  }

  openAttachment(): void {
    if (this.license?.licenseAttachmentUrl) {
      window.open(this.license.licenseAttachmentUrl, '_blank', 'noopener,noreferrer');
    }
  }

  confirmDecision(decision: 'Approved' | 'Rejected'): void {
    if (!this.propertyId || this.isSubmitting) return;

    const reason = this.rejectionReason.trim();
    if (decision === 'Rejected' && !reason) {
      this.toastr.warning(this.translate.instant('d3.buildReview.license.rejectionReasonRequired'));
      return;
    }

    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.licenseRejectTitle'
          : 'd3.buildReview.confirm.licenseApproveTitle',
        messageKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.licenseRejectMessage'
          : 'd3.buildReview.confirm.licenseApproveMessage',
        confirmKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.rejectAction'
          : 'd3.buildReview.confirm.approveAction',
        tone: decision === 'Rejected' ? 'reject' : 'approve'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) this.submitDecision(decision, reason);
    });
  }

  private submitDecision(decision: 'Approved' | 'Rejected', reason: string): void {
    const payload: LicenseReviewPayload = {
      decision,
      rejectionReason: decision === 'Rejected' ? reason : null
    };

    this.isSubmitting = true;
    this.buildingService.submitLicenseReview(this.propertyId, payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        const messageKey = response.decision === 'Rejected'
          ? 'd3.buildReview.license.rejectSuccess'
          : 'd3.buildReview.license.approveSuccess';
        this.toastr.success(this.translate.instant(messageKey));
        this.approve.emit(response);
      },
      error: (err) => {
        this.isSubmitting = false;
        const errorCode = err?.error?.code ?? err?.error?.errorCode;
        const messageKey = errorCode === 'REJECTION_REASON_REQUIRED'
          ? 'd3.buildReview.license.rejectionReasonRequired'
          : 'd3.toast.errorOp';
        this.toastr.error(this.translate.instant(messageKey));
      }
    });
  }
}
