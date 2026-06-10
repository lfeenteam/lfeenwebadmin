import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { AccountService } from '../../../../services/account.service';
import { AccountDetail } from '../../../../interfaces/account.model';

@Component({
  selector: 'app-review-account',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './review-account.component.html',
  styleUrl: './review-account.component.scss'
})
export class ReviewAccountComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private service   = inject(AccountService);
  private translate = inject(TranslateService);
  private toastr    = inject(ToastrService);

  account: AccountDetail | null = null;
  isLoading    = true;
  isSubmitting = false;
  rejectionReason = '';

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.service.getAccountById(id).subscribe({
      next: data => { this.account = data; this.isLoading = false; },
      error: ()   => { this.isLoading = false; }
    });
  }

  accept(): void {
    if (!this.account || this.isSubmitting) return;
    this.isSubmitting = true;
    this.service.acceptAccount(this.account.accountId).subscribe({
      next: () => {
        this.toastr.success(this.translate.instant('d3.reviewAccount.decision.acceptSuccess'));
        this.service.setTab('active');
        this.router.navigate([this.router.url.split('/')[1], 'd3', 'account-management']);
      },
      error: () => {
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
        this.isSubmitting = false;
      }
    });
  }

  reject(): void {
    if (!this.account || this.isSubmitting) return;
    if (!this.rejectionReason.trim()) {
      this.toastr.warning(this.translate.instant('d3.reviewAccount.decision.rejectionRequired'));
      return;
    }
    this.isSubmitting = true;
    this.service.rejectAccount(this.account.accountId, this.rejectionReason.trim()).subscribe({
      next: () => {
        this.toastr.success(this.translate.instant('d3.reviewAccount.decision.rejectSuccess'));
        this.service.setTab('rejected');
        this.router.navigate([this.router.url.split('/')[1], 'd3', 'account-management']);
      },
      error: () => {
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
        this.isSubmitting = false;
      }
    });
  }

  get isPending(): boolean {
    return this.account?.onboardingStatus === 'Draft' ||
           this.account?.onboardingStatus === 'PendingReview';
  }

  get tradeName(): string {
    return this.account?.business?.tradeNameAr
      || this.account?.business?.tradeNameEn
      || this.account?.business?.tradeName
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
