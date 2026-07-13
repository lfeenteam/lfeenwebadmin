import { Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { ReviewConfirmDialogComponent } from '../../../../build-review/review-confirm-dialog/review-confirm-dialog.component';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';
import { CancelPolicyType, UnitCancellationPolicyResponse } from '../../../../../interfaces/unit-card.model';
import { PageBreadcrumbTrailService } from '../../../../../services/page-breadcrumb-trail.service';
import { ReviewEmptyStateComponent } from 'src/app/components/dashboard3/review-empty-state/review-empty-state.component';

@Component({
  selector: 'app-cancel-policy-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule, ReviewEmptyStateComponent],
  templateUrl: './cancel-policy-review.component.html',
  styleUrl: './cancel-policy-review.component.scss'
})
export class CancelPolicyReviewComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageBreadcrumbTrail = inject(PageBreadcrumbTrailService);

  buildingId = '';
  unitId = '';
  rejectionNote = '';
  policy: UnitCancellationPolicyResponse | null = null;
  isLoading = false;
  isReadOnly = false;

  get policyType(): CancelPolicyType | null {
    return this.policy?.policyType ?? null;
  }

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

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId     = this.route.snapshot.paramMap.get('unitId')     ?? '';
    this.isReadOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';

    if (!this.unitId) return;
    this.isLoading = true;
    this.unitsService.getUnitCancellationPolicy(this.unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => { this.policy = data; this.isLoading = false; },
        error: () => { this.isLoading = false; }
      });
    this.unitsService.getUnitBasicData(this.unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        const lang = this.translate.currentLang || 'ar';
        this.pageBreadcrumbTrail.set([
          { label: data.title ?? '', translate: false, route: ['/', lang, 'd3', 'unit-review', this.buildingId, this.unitId] }
        ]);
      });
  }

  ngOnDestroy(): void {
    this.pageBreadcrumbTrail.clear();
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.unitId) return;
    const isApprove = decision === 'approved';
    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:   isApprove ? 'd3.unitReview.confirm.cancelPolicyApproveTitle'   : 'd3.unitReview.confirm.cancelPolicyRejectTitle',
        messageKey: isApprove ? 'd3.unitReview.confirm.cancelPolicyApproveMessage' : 'd3.unitReview.confirm.cancelPolicyRejectMessage',
        confirmKey: isApprove ? 'd3.unitReview.confirm.approveAction'              : 'd3.unitReview.confirm.rejectAction',
        tone: isApprove ? 'approve' : 'reject'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      const apiDecision = isApprove ? 'Approved' : 'Rejected';
      const rejectionReason = isApprove ? null : (this.rejectionNote.trim() || null);
      this.unitsService.reviewUnitCancellationPolicy(this.unitId, apiDecision, rejectionReason)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            if (this.buildingId) {
              this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'cancelPolicy', decision);
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
