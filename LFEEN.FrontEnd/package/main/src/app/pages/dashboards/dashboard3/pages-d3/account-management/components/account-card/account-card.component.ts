import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { Account } from '../../account-management.component';

@Component({
  selector: 'app-account-card',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './account-card.component.html',
  styleUrl: './account-card.component.scss'
})
export class AccountCardComponent {
  @Input() account!: Account;

  private router = inject(Router);
  private translate = inject(TranslateService);

  goToReview(): void {
    const lang = this.router.url.split('/')[1] || 'ar';
    this.router.navigate([lang, 'd3', 'account-management', 'review', this.account.id]);
  }

  get statusLabel(): string {
    const onboarding = this.account?.onboardingStatus;
    const onboardingMap: Record<string, string> = {
      Draft:         'd3.accountManagement.card.statusDraft',
      PendingReview: 'd3.accountManagement.card.statusPending',
      Approved:      'd3.accountManagement.card.statusActive',
      Rejected:      'd3.accountManagement.card.statusRejected',
    };
    if (onboarding && onboardingMap[onboarding]) {
      return this.translate.instant(onboardingMap[onboarding]);
    }
    const fallbackMap: Record<string, string> = {
      active:       'd3.accountManagement.card.statusActive',
      under_review: 'd3.accountManagement.card.statusUnderReview',
      rejected:     'd3.accountManagement.card.statusRejected',
      suspended:    'd3.accountManagement.card.statusSuspended',
    };
    const key = fallbackMap[this.account?.status];
    return key ? this.translate.instant(key) : '';
  }

  get idFieldLabel(): string {
    const key = this.account?.type === 'company'
      ? 'd3.accountManagement.card.idFieldCompany'
      : 'd3.accountManagement.card.idFieldIndividual';
    return this.translate.instant(key);
  }

  get actionLabel(): string {
    const key = this.account?.type === 'company'
      ? 'd3.accountManagement.card.actionCompany'
      : 'd3.accountManagement.card.actionIndividual';
    return this.translate.instant(key);
  }

  get avatarColor(): string {
    const colors = ['orange', 'blue', 'green', 'purple', 'red'];
    const code = (this.account?.avatarInitials ?? 'A').charCodeAt(0);
    return colors[code % colors.length];
  }
}
