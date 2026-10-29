import { Component, OnInit, inject, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { StatsRowComponent } from '../team-management/components/stats-row/stats-row.component';
import { AccountHeaderComponent } from './components/account-header/account-header.component';
import { AccountTabsBarComponent, AccountTab, AccountsPageTab } from './components/account-tabs-bar/account-tabs-bar.component';
import { ProfileChangesComponent } from '../profile-changes/profile-changes.component';
import { AccountProfileChangesService } from '../../services/account-profile-changes.service';
import { PAGE_FLAGS } from 'src/app/config/page-flags';
import { AccountCardComponent } from './components/account-card/account-card.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AccountService } from '../../services/account.service';
import { Account } from '../../interfaces/account.model';
import { StatItem } from '../../interfaces/stats.model';
import { getVisiblePages } from 'src/app/utils/pagination.util';

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
    ProfileChangesComponent,
  ],
  templateUrl: './account-management.component.html',
  styleUrl: './account-management.component.scss'
})
export class AccountManagementComponent implements OnInit {
  private accountService = inject(AccountService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);
  private profileChangesService = inject(AccountProfileChangesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // The profile-changes tab lives in the URL (?tab=profile-changes) so the review
  // screen's back button and breadcrumb return to it.
  activeTab: AccountsPageTab = PAGE_FLAGS['profile-changes'] && this.route.snapshot.queryParamMap.get('tab') === 'profile-changes'
    ? 'profile_changes'
    : this.accountService.activeTab();
  profileChangesCount: number | null = null;
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

  ngOnInit(): void {
    if (!PAGE_FLAGS['profile-changes']) return;
    this.profileChangesService.list({ pageNumber: 1, pageSize: 1 }).subscribe({
      next: (res) => this.profileChangesCount = res?.totalCount ?? null,
      error: () => this.profileChangesCount = null
    });
  }

  get isProfileChangesTab(): boolean {
    return this.activeTab === 'profile_changes';
  }

  // The status filter in the header only knows account statuses.
  get accountTab(): AccountTab {
    return this.isProfileChangesTab ? this.accountService.activeTab() : this.activeTab as AccountTab;
  }

  get filteredAccounts(): Account[] {
    switch (this.activeTab) {
      case 'all':          return this.accounts;
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

  setActiveTab(tab: AccountsPageTab): void {
    const wasProfileChanges = this.isProfileChangesTab;
    this.activeTab = tab;
    if (tab === 'profile_changes') {
      this.syncTabParam('profile-changes');
      return;
    }
    this.accountService.setTab(tab);
    if (wasProfileChanges) this.syncTabParam(null);
  }

  private syncTabParam(tab: string | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
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
    return getVisiblePages(this.currentPage, this.totalPages);
  }
}
