import { Component, OnInit, OnDestroy, inject, DestroyRef, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { AccountService } from '../../../../services/account.service';
import { AccountDetail, isSubmittedForReview } from '../../../../interfaces/account.model';
import { ReviewConfirmDialogComponent } from '../../../build-review/review-confirm-dialog/review-confirm-dialog.component';
import { PageTitleOverrideService } from '../../../../services/page-title-override.service';
import { PermissionService } from '../../../../services/permission.service';
import { AdditionalConditionsReviewComponent } from 'src/app/components/dashboard3/additional-conditions-review/additional-conditions-review.component';
import { AdminAdditionalCondition } from '../../../../interfaces/additional-condition.model';

import { AppDatePipe } from 'src/app/pipes/app-date.pipe';

@Component({
  selector: 'app-review-account',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule, AdditionalConditionsReviewComponent, AppDatePipe],
  templateUrl: './review-account.component.html',
  styleUrl: './review-account.component.scss'
})
export class ReviewAccountComponent implements OnInit, OnDestroy {
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private service    = inject(AccountService);
  private translate  = inject(TranslateService);
  private toastr     = inject(ToastrService);
  private dialog     = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  private pageTitleOverride = inject(PageTitleOverrideService);
  private perms = inject(PermissionService);

  /** BUG-2739: a view-only admin sees the account but not the accept/reject decision. */
  readonly canManage = computed(() => this.perms.canWrite('accounts'));

  private accountId: string | null = null;
  private loadSub?: Subscription;

  account: AccountDetail | null = null;
  isLoading    = true;
  isError      = false;
  isSubmitting = false;
  rejectionReason = '';
  isUnifiedNumberInvalid = false;
  additionalConditions: AdminAdditionalCondition[] = [];

  basicNameAr = '';
  basicNameEn = '';
  showBasicNameSecondary = false;

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  get primaryBasicName(): string {
    return this.currentLang === 'ar' ? this.basicNameAr : this.basicNameEn;
  }
  set primaryBasicName(value: string) {
    if (this.currentLang === 'ar') this.basicNameAr = value;
    else this.basicNameEn = value;
  }

  ngOnInit(): void {
    // Angular reuses this component when only :id changes (notification, Back, URL edit),
    // so react to every param change instead of reading the snapshot once.
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.accountId = params.get('id');
        this.resetState();
        this.loadAccount();
      });

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadAccount());
  }

  reloadAccount(): void {
    this.loadAccount();
  }

  // Clear the previous account so its decision buttons and form input never show under another id
  private resetState(): void {
    this.account = null;
    this.additionalConditions = [];
    this.rejectionReason = '';
    this.isUnifiedNumberInvalid = false;
    this.isSubmitting = false;
    this.basicNameAr = '';
    this.basicNameEn = '';
    this.showBasicNameSecondary = false;
  }

  private loadAccount(): void {
    const id = this.accountId;
    if (!id) return;
    this.loadSub?.unsubscribe();
    this.isLoading = true;
    this.isError = false;
    this.loadSub = this.service.getAccountById(id).subscribe({
      next: data => {
        this.account = data;
        this.additionalConditions = data.additionalConditions ?? [];
        // Prefill each language from its own field only: basicName follows the request language,
        // so using it here put the English name in the Arabic box (BUG-0888).
        // Keep what the reviewer already typed when the page reloads on a language switch.
        const business = data.business;
        this.basicNameAr ||= business?.basicNameAr || business?.tradeNameAr || '';
        this.basicNameEn ||= business?.basicNameEn || business?.tradeNameEn || '';
        this.isLoading = false;
        this.pageTitleOverride.set(this.tradeName !== '—' ? this.tradeName : null);
      },
      error: ()  => {
        this.isLoading = false;
        this.isError   = true;
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
      }
    });
  }

  ngOnDestroy(): void {
    this.loadSub?.unsubscribe();
    this.pageTitleOverride.clear();
  }

  accept(): void {
    if (!this.canManage() || !this.account || this.isSubmitting) return;
    // Both languages are required: never copy one into the other, or the approved name is saved in the wrong language
    const basicNameAr = this.basicNameAr.trim();
    const basicNameEn = this.basicNameEn.trim();
    if (!basicNameAr || !basicNameEn) {
      // Open the other-language box so the reviewer can see which one is missing
      this.showBasicNameSecondary = true;
      this.toastr.warning(this.translate.instant('d3.reviewAccount.decision.basicNameRequired'));
      return;
    }
    const accountId = this.account.accountId;
    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:          'd3.reviewAccount.decision.confirm.approveTitle',
        messageKey:        'd3.reviewAccount.decision.confirm.approveMessage',
        confirmKey:        'd3.reviewAccount.decision.confirm.approveAction',
        tone:              'approve',
        successTitleKey:   'common.done',
        successMessageKey: 'd3.reviewAccount.decision.acceptSuccess',
        onConfirm: () => this.service.acceptAccount(accountId, { basicNameAr, basicNameEn }),
        errorKeyFor: (err: any) => {
          const key = this.decisionErrorKey(err);
          // The screen showed a stale state — reload so the decision actions disappear
          if (key) this.reloadAccount();
          return key;
        }
      }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.setTab('active');
      this.navigateBack();
    });
  }

  reject(): void {
    if (!this.canManage() || !this.account || this.isSubmitting) return;
    if (!this.rejectionReason.trim()) {
      this.toastr.warning(this.translate.instant('d3.reviewAccount.decision.rejectionRequired'));
      return;
    }
    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:   'd3.reviewAccount.decision.confirm.rejectTitle',
        messageKey: 'd3.reviewAccount.decision.confirm.rejectMessage',
        confirmKey: 'd3.reviewAccount.decision.confirm.rejectAction',
        tone:       'reject'
      }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.isSubmitting = true;
      this.service.rejectAccount(this.account!.accountId, {
        rejectionReason: this.rejectionReason.trim(),
        isUnifiedNumberInvalid: this.isUnifiedNumberInvalid
      }).subscribe({
        next: () => {
          this.toastr.success(this.translate.instant('d3.reviewAccount.decision.rejectSuccess'));
          this.service.setTab('rejected');
          this.navigateBack();
        },
        error: (err) => {
          const key = this.decisionErrorKey(err);
          this.toastr.error(this.translate.instant(key ?? 'd3.toast.errorOp'));
          this.isSubmitting = false;
          if (key) this.reloadAccount();
        }
      });
    });
  }

  private navigateBack(): void {
    const lang = this.translate.currentLang || 'ar';
    this.router.navigate([lang, 'd3', 'account-management']);
  }

  // Draft accounts haven't been submitted for review yet, so there's nothing to
  // accept/reject. A draft also has onboardingStatus=PendingReview, so the decision
  // actions need submittedForReviewAtUtc too (BUG-2530).
  get isPending(): boolean {
    return isSubmittedForReview(this.account);
  }

  /** Created but never submitted: show a notice instead of the decision actions. */
  get isDraft(): boolean {
    return this.account?.onboardingStatus === 'PendingReview' && !this.account.submittedForReviewAtUtc;
  }

  /** Backend errorCode → translation key; null = fall back to the generic error. */
  private decisionErrorKey(err: any): string | null {
    const code: string | undefined = err?.error?.errorCode ?? err?.error?.code;
    return code === 'ACCOUNT_NOT_SUBMITTED' ? 'd3.reviewAccount.decision.errors.notSubmitted' : null;
  }

  get tradeName(): string {
    const business = this.account?.business;
    return (this.translate.currentLang === 'ar' ? business?.tradeNameAr : business?.tradeNameEn)
      || business?.tradeName
      || business?.tradeNameAr
      || business?.tradeNameEn
      || '—';
  }

  get companyInitials(): string {
    return this.tradeName.trim().slice(0, 2);
  }

  get hasLogo(): boolean {
    return !!this.account?.business?.logoUrl;
  }

  openDocument(url: string): void {
    window.open(url, '_blank');
  }

  getDocumentFileName(url: string): string {
    const name = url.split('/').pop()?.split('?')[0] || 'document.pdf';
    return name;
  }

  get dir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'ar' ? 'rtl' : 'ltr';
  }

  get businessCategoryLabel(): string {
    const cat = this.account?.business?.businessCategory;
    if (!cat) return '—';
    const match = cat.match(/PropertyType\.(.+)\.Name/);
    if (match) {
      const key = `d3.businessCategories.${match[1]}`;
      const translated = this.translate.instant(key);
      return translated !== key ? translated : cat;
    }
    return cat;
  }

  sectionStatusLabel(status: string | null | undefined): string {
    if (!status) return '—';
    const key = `d3.reviewAccount.sectionStatus.${status}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  sectionStatusClass(status: string | null | undefined): string {
    switch (status) {
      case 'Approved':      return 'approved';
      case 'PendingReview': return 'pending';
      case 'Rejected':      return 'rejected';
      default:               return 'draft';
    }
  }
}
