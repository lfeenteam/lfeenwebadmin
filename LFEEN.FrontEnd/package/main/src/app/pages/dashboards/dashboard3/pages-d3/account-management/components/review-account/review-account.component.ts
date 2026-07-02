import { Component, OnInit, OnDestroy, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { AccountService } from '../../../../services/account.service';
import { AccountDetail } from '../../../../interfaces/account.model';
import { ReviewConfirmDialogComponent } from '../../../build-review/review-confirm-dialog/review-confirm-dialog.component';
import { PageTitleOverrideService } from '../../../../services/page-title-override.service';

@Component({
  selector: 'app-review-account',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
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

  account: AccountDetail | null = null;
  isLoading    = true;
  isError      = false;
  isSubmitting = false;
  rejectionReason = '';

  ngOnInit(): void {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadAccount());

    this.loadAccount();
  }

  private loadAccount(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.isLoading = true;
    this.isError = false;
    this.service.getAccountById(id).subscribe({
      next: data => {
        this.account = data;
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
    this.pageTitleOverride.clear();
  }

  accept(): void {
    if (!this.account || this.isSubmitting) return;
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
        onConfirm: () => this.service.acceptAccount(accountId)
      }
    });
    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.setTab('active');
      this.navigateBack();
    });
  }

  reject(): void {
    if (!this.account || this.isSubmitting) return;
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
      this.service.rejectAccount(this.account!.accountId, this.rejectionReason.trim()).subscribe({
        next: () => {
          this.toastr.success(this.translate.instant('d3.reviewAccount.decision.rejectSuccess'));
          this.service.setTab('rejected');
          this.navigateBack();
        },
        error: () => {
          this.toastr.error(this.translate.instant('d3.toast.errorOp'));
          this.isSubmitting = false;
        }
      });
    });
  }

  private navigateBack(): void {
    const lang = this.translate.currentLang || 'ar';
    this.router.navigate([lang, 'd3', 'account-management']);
  }

  get isPending(): boolean {
    return this.account?.onboardingStatus === 'Draft' ||
           this.account?.onboardingStatus === 'PendingReview';
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
}
