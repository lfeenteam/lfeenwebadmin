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
import { UnitDepositResponse } from '../../../../../interfaces/unit-card.model';
import { PageBreadcrumbTrailService } from '../../../../../services/page-breadcrumb-trail.service';

@Component({
  selector: 'app-unit-deposit-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule],
  templateUrl: './unit-deposit-review.component.html',
  styleUrl: './unit-deposit-review.component.scss'
})
export class UnitDepositReviewComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageBreadcrumbTrail = inject(PageBreadcrumbTrailService);

  buildingId = '';
  unitId = '';
  rejectionNote = '';
  deposit: UnitDepositResponse | null = null;
  isLoading = false;
  isReadOnly = false;
  currentLang = 'ar';

  get depositAmount(): number {
    return this.deposit?.amount ?? 0;
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unitsService: UnitsService,
    private translate: TranslateService,
    private dialog: MatDialog
  ) {
    this.currentLang = this.translate.currentLang || 'ar';
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });
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
    this.unitsService.getUnitDeposit(this.unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => { this.deposit = data; this.isLoading = false; },
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
        titleKey:   isApprove ? 'd3.unitReview.confirm.depositApproveTitle'   : 'd3.unitReview.confirm.depositRejectTitle',
        messageKey: isApprove ? 'd3.unitReview.confirm.depositApproveMessage' : 'd3.unitReview.confirm.depositRejectMessage',
        confirmKey: isApprove ? 'd3.unitReview.confirm.approveAction'         : 'd3.unitReview.confirm.rejectAction',
        tone: isApprove ? 'approve' : 'reject'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      const apiDecision = isApprove ? 'Approved' : 'Rejected';
      const rejectionReason = isApprove ? null : (this.rejectionNote.trim() || null);
      this.unitsService.reviewUnitDeposit(this.unitId, apiDecision, rejectionReason)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            if (this.buildingId) {
              this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'deposit', decision);
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
