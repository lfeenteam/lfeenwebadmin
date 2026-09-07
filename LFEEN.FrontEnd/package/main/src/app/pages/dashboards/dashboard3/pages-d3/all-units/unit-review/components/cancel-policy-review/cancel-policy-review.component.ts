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
import {
  CancelPolicyRule,
  CancelPolicySet,
  CancelPolicyWarningCode,
  UnitCancellationPolicyResponse,
} from '../../../../../interfaces/unit-card.model';
import { PageBreadcrumbTrailService } from '../../../../../services/page-breadcrumb-trail.service';
import { ReviewEmptyStateComponent } from 'src/app/components/dashboard3/review-empty-state/review-empty-state.component';

interface PeriodView {
  windowKey: string;
  windowParams: Record<string, number>;
  refundPercentage: number | null;
  isFallback: boolean;
}

interface RuleView {
  ruleType: CancelPolicyRule['ruleType'];
  name: string;
  priority: number;
  isFlexible: boolean;
  isPercentage: boolean;
  refundPercentage: number | null;
  refundFixedAmount: number | null;
  requiresNote: boolean;
  reasons: string[];
  periods: PeriodView[];
}

interface SetView {
  name: string;
  rules: RuleView[];
}

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
  loadError = false;
  isReadOnly = false;
  currentLang = 'ar';

  /** Display-ready models, rebuilt on load and on language change. */
  viewSet: SetView | null = null;
  viewBaseline: SetView | null = null;

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
      .subscribe(event => {
        this.currentLang = event.lang;
        // The endpoint returns server-localized text (reason labels, rule names),
        // so re-fetch on every language switch to keep it in sync with the UI.
        if (this.unitId) this.loadPolicy(false);
      });
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  /** True while the host has an edit awaiting the admin's decision. */
  get isPendingUpdate(): boolean {
    return this.policy?.decision === 'PendingUpdate' && !!this.policy?.pending;
  }

  get hasPolicy(): boolean {
    return !!this.viewSet;
  }

  /** Deduplicated advisory warnings — never block approval. */
  get warnings(): CancelPolicyWarningCode[] {
    return [...new Set(this.policy?.warnings ?? [])];
  }

  warningKey(code: CancelPolicyWarningCode): string {
    return `d3.unitReview.cancelPolicyView.warnings.${code}`;
  }

  ruleTypeKey(ruleType: CancelPolicyRule['ruleType']): string {
    const map: Record<CancelPolicyRule['ruleType'], string> = {
      FullRefund: 'd3.unitReview.cancelPolicyView.ruleType.fullRefund',
      Flexible: 'd3.unitReview.cancelPolicyView.ruleType.flexible',
      NonRefundable: 'd3.unitReview.cancelPolicyView.ruleType.nonRefundable',
    };
    return map[ruleType];
  }

  retry(): void {
    this.loadPolicy(true);
  }

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId     = this.route.snapshot.paramMap.get('unitId')     ?? '';
    this.isReadOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';

    if (!this.unitId) return;
    this.loadPolicy(true);
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

  /** Fetches the policy for the current unit in the active language. */
  private loadPolicy(showSpinner: boolean): void {
    if (!this.unitId) return;
    this.loadError = false;
    if (showSpinner) this.isLoading = true;
    this.unitsService.getUnitCancellationPolicy(this.unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.policy = data;
          this.rebuildViews();
          this.isLoading = false;
        },
        error: () => {
          this.loadError = true;
          this.isLoading = false;
        }
      });
  }

  private rebuildViews(): void {
    const reviewSet = this.policy?.pending ?? this.policy?.current ?? null;
    this.viewSet = this.buildSet(reviewSet);
    this.viewBaseline = this.isPendingUpdate ? this.buildSet(this.policy?.current ?? null) : null;
  }

  private buildSet(set: CancelPolicySet | null): SetView | null {
    if (!set) return null;
    return {
      name: this.localized(set.nameAr, set.nameEn),
      rules: [...(set.rules ?? [])]
        .sort((a, b) => a.priority - b.priority)
        .map(r => ({
          ruleType: r.ruleType,
          name: this.localized(r.nameAr, r.nameEn),
          priority: r.priority,
          isFlexible: r.ruleType === 'Flexible',
          isPercentage: r.refundCalculationType === 'Percentage',
          refundPercentage: r.refundPercentage,
          refundFixedAmount: r.refundFixedAmount,
          requiresNote: r.requiresNote,
          reasons: r.reasons ?? [],
          periods: this.buildPeriods(r),
        })),
    };
  }

  /** Sorts a Flexible rule's periods by order and prepares a display-ready window label. */
  private buildPeriods(rule: CancelPolicyRule): PeriodView[] {
    return [...(rule.periods ?? [])]
      .sort((a, b) => a.order - b.order)
      .map(p => {
        const min = p.minimumHoursBeforeCheckIn;
        const max = p.maximumHoursBeforeCheckIn;
        let windowKey: string;
        let windowParams: Record<string, number> = {};
        if (min != null && max != null) {
          windowKey = 'd3.unitReview.cancelPolicyView.periodWindow.between';
          windowParams = { min, max };
        } else if (min != null) {
          windowKey = 'd3.unitReview.cancelPolicyView.periodWindow.after';
          windowParams = { min };
        } else if (max != null) {
          windowKey = 'd3.unitReview.cancelPolicyView.periodWindow.before';
          windowParams = { max };
        } else {
          windowKey = 'd3.unitReview.cancelPolicyView.periodWindow.any';
        }
        return { windowKey, windowParams, refundPercentage: p.refundPercentage, isFallback: p.isFallback };
      });
  }

  private localized(ar: string, en: string): string {
    return this.currentLang === 'en' ? (en || ar) : (ar || en);
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
