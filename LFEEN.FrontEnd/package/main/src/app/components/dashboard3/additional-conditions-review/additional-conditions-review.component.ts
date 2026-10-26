import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { ReviewConfirmDialogComponent } from 'src/app/pages/dashboards/dashboard3/pages-d3/build-review/review-confirm-dialog/review-confirm-dialog.component';
import { AdditionalConditionsService } from 'src/app/pages/dashboards/dashboard3/services/additional-conditions.service';
import {
  ADDITIONAL_CONDITION_REASON_MAX,
  AdditionalConditionDecisionItem,
  AdditionalConditionScope,
  AdminAdditionalCondition
} from 'src/app/pages/dashboards/dashboard3/interfaces/additional-condition.model';

// Per-condition review of host-written additional conditions (doc section 8.1).
// Used inside the account / property terms / unit terms review screens, and by the
// pending-review list page (showTarget) where rows belong to different targets.
// Deciding a condition here never touches the Terms section's own decision.
@Component({
  selector: 'app-additional-conditions-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TablerIconsModule],
  templateUrl: './additional-conditions-review.component.html',
  styleUrl: './additional-conditions-review.component.scss'
})
export class AdditionalConditionsReviewComponent {
  @Input({ required: true }) scope!: AdditionalConditionScope;
  // The id the page already uses for this level's endpoints (e.g. /terms). When
  // omitted, each condition's own accountId/propertyId/unitId is used instead.
  @Input() targetId: string | number | null = null;
  @Input() conditions: AdminAdditionalCondition[] = [];
  @Input() readOnly = false;
  @Input() showHeader = true;
  @Input() showTarget = false;

  @Output() conditionsChange = new EventEmitter<AdminAdditionalCondition[]>();
  @Output() decided = new EventEmitter<AdminAdditionalCondition>();
  @Output() reloadRequested = new EventEmitter<void>();
  @Output() openTarget = new EventEmitter<AdminAdditionalCondition>();

  private service = inject(AdditionalConditionsService);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private dialog = inject(MatDialog);

  readonly reasonMax = ADDITIONAL_CONDITION_REASON_MAX;
  rejectingId: number | null = null;
  reasons: Record<number, string> = {};
  submittingIds = new Set<number>();
  isBulkSubmitting = false;

  get dir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  private get isAr(): boolean {
    return this.translate.currentLang !== 'en';
  }

  get pendingConditions(): AdminAdditionalCondition[] {
    return this.conditions.filter(c => this.isPending(c));
  }

  // Bulk approval only makes sense when every row shares one target endpoint.
  get canApproveAll(): boolean {
    return !this.readOnly && !this.showTarget && this.pendingConditions.length > 1;
  }

  isPending(c: AdminAdditionalCondition): boolean {
    return c.decision === 'Pending' || c.decision === 'PendingUpdate';
  }

  // PendingUpdate: show the approved text guests still see next to the new edit.
  hasPendingEdit(c: AdminAdditionalCondition): boolean {
    return c.decision === 'PendingUpdate'
      && !!(c.approvedTitle || c.approvedTitleAr || c.approvedTitleEn);
  }

  canApprove(c: AdminAdditionalCondition): boolean {
    return !this.readOnly && this.isPending(c);
  }

  // Rejecting an already-approved condition hides it from guests (doc section 1).
  canReject(c: AdminAdditionalCondition): boolean {
    return !this.readOnly && c.decision !== 'Rejected';
  }

  isBusy(c: AdminAdditionalCondition): boolean {
    return this.isBulkSubmitting || this.submittingIds.has(c.id);
  }

  statusClass(c: AdminAdditionalCondition): string {
    switch (c.decision) {
      case 'Approved':      return 'approved';
      case 'Rejected':      return 'rejected';
      case 'PendingUpdate': return 'update';
      default:              return 'pending';
    }
  }

  title(c: AdminAdditionalCondition, approved = false): string | null {
    return approved
      ? this.localized(c.approvedTitleAr, c.approvedTitleEn, c.approvedTitle)
      : this.localized(c.titleAr, c.titleEn, c.title);
  }

  description(c: AdminAdditionalCondition, approved = false): string | null {
    return approved
      ? this.localized(c.approvedDescriptionAr, c.approvedDescriptionEn, c.approvedDescription)
      : this.localized(c.descriptionAr, c.descriptionEn, c.description);
  }

  // Text in the UI language only; falls back to the other language while the
  // backend translation hasn't filled it in yet.
  private localized(ar: string | null, en: string | null, fallback: string | null): string | null {
    return (this.isAr ? ar : en) || fallback || (this.isAr ? en : ar) || null;
  }

  targetName(c: AdminAdditionalCondition): string {
    return [c.accountName, c.propertyName, c.unitName].filter(Boolean).join(' · ') || '—';
  }

  startReject(c: AdminAdditionalCondition): void {
    this.rejectingId = c.id;
    this.reasons[c.id] = this.reasons[c.id] ?? '';
  }

  cancelReject(): void {
    this.rejectingId = null;
  }

  approve(c: AdminAdditionalCondition): void {
    if (!this.canApprove(c) || this.isBusy(c)) return;
    this.confirm('approve', () =>
      this.submit([{ id: c.id, decision: 'Approved', updatedAt: c.updatedAt }], this.resolveTarget(c), 'approveSuccess')
    );
  }

  reject(c: AdminAdditionalCondition): void {
    if (!this.canReject(c) || this.isBusy(c)) return;
    const reason = (this.reasons[c.id] ?? '').trim();
    if (!reason) {
      this.toastr.warning(this.translate.instant('d3.additionalConditions.errors.reasonRequired'));
      return;
    }
    this.confirm('reject', () =>
      this.submit(
        [{ id: c.id, decision: 'Rejected', rejectionReason: reason, updatedAt: c.updatedAt }],
        this.resolveTarget(c),
        'rejectSuccess'
      )
    );
  }

  approveAll(): void {
    if (!this.canApproveAll || this.isBulkSubmitting) return;
    const items = this.pendingConditions.map<AdditionalConditionDecisionItem>(c => ({
      id: c.id, decision: 'Approved', updatedAt: c.updatedAt
    }));
    this.confirm('approveAll', () =>
      this.submit(items, this.resolveTarget(this.pendingConditions[0]), 'approveAllSuccess', true)
    );
  }

  private resolveTarget(c: AdminAdditionalCondition): string | number | null {
    if (this.targetId !== null && this.targetId !== '') return this.targetId;
    switch (this.scope) {
      case 'account':  return c.accountId;
      case 'property': return c.propertyId;
      default:         return c.unitId;
    }
  }

  private confirm(kind: 'approve' | 'reject' | 'approveAll', onConfirmed: () => void): void {
    const ref = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:   `d3.additionalConditions.confirm.${kind}Title`,
        messageKey: `d3.additionalConditions.confirm.${kind}Message`,
        confirmKey: kind === 'reject' ? 'd3.buildReview.confirm.rejectAction' : 'd3.buildReview.confirm.approveAction',
        tone:       kind === 'reject' ? 'reject' : 'approve'
      }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) onConfirmed();
    });
  }

  private submit(
    items: AdditionalConditionDecisionItem[],
    targetId: string | number | null,
    successKey: string,
    bulk = false
  ): void {
    if (targetId === null || targetId === undefined || targetId === '') {
      this.toastr.error(this.translate.instant('d3.toast.errorOp'));
      return;
    }
    if (bulk) this.isBulkSubmitting = true;
    items.forEach(i => this.submittingIds.add(i.id));

    this.service.review(this.scope, targetId, items).subscribe({
      next: (updated) => {
        this.finish(items, bulk);
        this.applyResult(items, updated);
        this.rejectingId = null;
        this.toastr.success(this.translate.instant(`d3.additionalConditions.toast.${successKey}`));
      },
      error: (err) => {
        this.finish(items, bulk);
        this.handleError(err);
      }
    });
  }

  private finish(items: AdditionalConditionDecisionItem[], bulk: boolean): void {
    if (bulk) this.isBulkSubmitting = false;
    items.forEach(i => this.submittingIds.delete(i.id));
  }

  // The response is the level's list after the decision; merge it by id so rows of
  // other targets (pending list page) stay untouched. If it comes back empty, reflect
  // the decision locally instead of leaving stale buttons on screen.
  private applyResult(items: AdditionalConditionDecisionItem[], updated: AdminAdditionalCondition[]): void {
    const byId = new Map(updated.map(c => [c.id, c]));
    const decidedIds = new Set(items.map(i => i.id));
    const next = this.conditions.map(c => {
      if (byId.has(c.id)) return byId.get(c.id)!;
      if (!decidedIds.has(c.id)) return c;
      const item = items.find(i => i.id === c.id)!;
      return {
        ...c,
        decision: item.decision,
        rejectionReason: item.decision === 'Rejected' ? item.rejectionReason ?? null : null,
        reviewedAt: new Date().toISOString()
      };
    });
    this.conditions = next;
    this.conditionsChange.emit(next);
    next.filter(c => decidedIds.has(c.id)).forEach(c => this.decided.emit(c));
  }

  private handleError(err: any): void {
    const code: string | undefined = err?.error?.code ?? err?.error?.errorCode;
    const keyByCode: Record<string, string> = {
      CONDITION_CHANGED:              'd3.additionalConditions.errors.changed',
      REJECTION_REASON_REQUIRED:      'd3.additionalConditions.errors.reasonRequired',
      CONDITION_TARGET_MISMATCH:      'd3.additionalConditions.errors.targetMismatch',
      DUPLICATE_CONDITION:            'd3.additionalConditions.errors.duplicate',
      NOT_FOUND:                      'd3.additionalConditions.errors.notFound',
      ADDITIONAL_CONDITION_NOT_FOUND: 'd3.additionalConditions.errors.notFound'
    };
    let key = (code && keyByCode[code]) || 'd3.toast.errorOp';
    if (!code && err?.status === 403) key = 'd3.additionalConditions.errors.forbidden';
    this.toastr.error(this.translate.instant(key));

    // The list on screen no longer matches the server — reload it so the reviewer
    // decides on the text that's actually there.
    if (code === 'CONDITION_CHANGED' || code === 'CONDITION_TARGET_MISMATCH'
      || code === 'NOT_FOUND' || code === 'ADDITIONAL_CONDITION_NOT_FOUND') {
      this.reloadRequested.emit();
    }
  }
}
