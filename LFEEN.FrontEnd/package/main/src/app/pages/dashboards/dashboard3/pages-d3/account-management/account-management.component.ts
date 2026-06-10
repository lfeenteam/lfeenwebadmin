import { Component, OnInit, inject, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { StatsRowComponent } from '../team-management/components/stats-row/stats-row.component';
import { AccountHeaderComponent } from './components/account-header/account-header.component';
import { AccountTabsBarComponent, AccountTab } from './components/account-tabs-bar/account-tabs-bar.component';
import { AccountCardComponent } from './components/account-card/account-card.component';
import { TranslateModule } from '@ngx-translate/core';
import { AccountService } from '../../services/account.service';
import { Account } from '../../interfaces/account.model';

export type { Account } from '../../interfaces/account.model';

@Component({
  selector: 'app-account-management',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    TablerIconsModule,
    StatsRowComponent,
    AccountHeaderComponent,
    AccountTabsBarComponent,
    AccountCardComponent,
    TranslateModule,
  ],
  templateUrl: './account-management.component.html',
  styleUrl: './account-management.component.scss'
})
export class AccountManagementComponent implements OnInit {
  private accountService = inject(AccountService);
  private cdr = inject(ChangeDetectorRef);

  activeTab: AccountTab = this.accountService.activeTab();
  searchQuery = '';

  accounts: Account[] = [];
  totalPages  = 1;
  currentPage = 1;
  pageNumbers: number[] = [];
  isLoading   = false;
  newestFirst = true;

  stats = [
    { label: 'إجمالي الحسابات', value: '—', icon: 'database',    color: 'primary', valueColor: '#000'    },
    { label: 'نشط',             value: '—', icon: 'circle-check', color: 'success', valueColor: '#16a34a' },
    { label: 'تحت المراجعة',   value: '—', icon: 'clock',        color: 'warning', valueColor: '#d97706' },
    { label: 'مرفوض',           value: '—', icon: 'circle-x',     color: 'danger',  valueColor: '#ef4444' },
  ];

  constructor() {
    effect(() => {
      this.accounts    = this.accountService.accounts();
      this.totalPages  = this.accountService.totalPages();
      this.currentPage = this.accountService.currentPage();
      this.isLoading   = this.accountService.isLoading();
      this.newestFirst = this.accountService.newestFirst();
      this.pageNumbers = Array.from({ length: this.totalPages }, (_, i) => i + 1);
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    // Draft=0, PendingReview=1, Approved=2, Rejected=3
    forkJoin({
      total:       this.accountService.getStatusCount(null),
      approved:    this.accountService.getStatusCount(2),
      underReview: this.accountService.getStatusCount(0),
      pending:     this.accountService.getStatusCount(1),
      rejected:    this.accountService.getStatusCount(3),
    }).subscribe(counts => {
      this.stats[0].value = String(counts.total);
      this.stats[1].value = String(counts.approved);
      this.stats[2].value = String(counts.underReview + counts.pending);
      this.stats[3].value = String(counts.rejected);
      this.cdr.markForCheck();
    });
  }

  get filteredAccounts(): Account[] {
    switch (this.activeTab) {
      case 'all':          return this.accounts.filter(a => a.status !== 'under_review');
      case 'under_review': return this.accounts.filter(a => a.status === 'under_review');
      default:             return this.accounts;
    }
  }

  setActiveTab(tab: AccountTab): void {
    this.activeTab = tab;
    this.accountService.setTab(tab);
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.accountService.setSearch(query);
  }

  onSortChange(value: boolean): void {
    this.accountService.setNewestFirst(value);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.accountService.goToPage(page);
  }
}
