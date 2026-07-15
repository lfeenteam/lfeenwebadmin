import { Component, OnInit, inject, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { StatsRowComponent } from '../team-management/components/stats-row/stats-row.component';
import { AccountHeaderComponent } from './components/account-header/account-header.component';
import { AccountTabsBarComponent, AccountTab } from './components/account-tabs-bar/account-tabs-bar.component';
import { AccountCardComponent } from './components/account-card/account-card.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AccountService } from '../../services/account.service';
import { Account } from '../../interfaces/account.model';
import { StatItem } from '../../interfaces/stats.model';

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
    DashboardLoadingComponent,
    DashboardEmptyComponent,
    TranslateModule,
  ],
  templateUrl: './account-management.component.html',
  styleUrl: './account-management.component.scss'
})
export class AccountManagementComponent implements OnInit {
  private accountService = inject(AccountService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);

  activeTab: AccountTab = this.accountService.activeTab();
  searchQuery = '';

  accounts: Account[] = [];
  totalPages  = 1;
  currentPage = 1;
  totalCount  = 0;
  pageNumbers: number[] = [];
  isLoading   = false;
  newestFirst = true;

  stats: StatItem[] = [
    { label: 'd3.accountManagement.stats.total',       value: '—', icon: 'database',    color: 'primary', valueColor: '#000'    },
    { label: 'd3.accountManagement.stats.active',      value: '—', icon: 'circle-check', color: 'success', valueColor: '#16a34a' },
    { label: 'd3.accountManagement.stats.underReview', value: '—', icon: 'clock',        color: 'warning', valueColor: '#d97706' },
    { label: 'd3.accountManagement.stats.rejected',    value: '—', icon: 'circle-x',     color: 'danger',  valueColor: '#ef4444' },
  ];

  constructor() {
    effect(() => {
      this.accounts    = this.accountService.accounts();
      this.totalPages  = this.accountService.totalPages();
      this.currentPage = this.accountService.currentPage();
      this.totalCount  = this.accountService.totalCount();
      this.isLoading   = this.accountService.isLoading();
      this.newestFirst = this.accountService.newestFirst();
      this.pageNumbers = Array.from({ length: this.totalPages }, (_, i) => i + 1);

      const s = this.accountService.accountStats();
      if (s) {
        this.stats[0].value = String(s.total);
        this.stats[1].value = String(s.activeOrPublished);
        this.stats[2].value = String(s.underReview);
        this.stats[3].value = String(s.rejected);
      }

      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {}

  get filteredAccounts(): Account[] {
    switch (this.activeTab) {
      case 'all':          return this.accounts;
      case 'draft':        return this.accounts.filter(a => a.status === 'draft');
      case 'under_review': return this.accounts.filter(a => a.status === 'under_review');
      default:             return this.accounts;
    }
  }

  get emptyTitleKey(): string {
    return `d3.emptyState.accounts.${this.activeTab}.title`;
  }

  get emptyDescKey(): string {
    return `d3.emptyState.accounts.${this.activeTab}.desc`;
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

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): (number | '...')[] {
    const n = this.totalPages;
    const c = this.currentPage;
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    if (c <= 4)     return [1, 2, 3, 4, '...', n - 2, n - 1, n];
    if (c >= n - 3) return [1, 2, 3, '...', n - 3, n - 2, n - 1, n];
    return [1, 2, 3, '...', c, '...', n - 2, n - 1, n];
  }
}
