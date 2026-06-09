import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { AccountItem, PaginatedAccountResponse, Account } from '../interfaces/account.model';
import { AccountTab } from '../pages-d3/account-management/components/account-tabs-bar/account-tabs-bar.component';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private http = inject(HttpClient);
  private readonly apiUrl = 'http://test-api-admin.lfeen.com/api/accounts';

  readonly currentPage  = signal(1);
  readonly pageSize     = signal(20);
  readonly searchQuery  = signal('');
  readonly activeTab    = signal<AccountTab>('all');
  readonly newestFirst  = signal(true);

  private readonly _accountsResource = rxResource({
    request: () => ({
      page:        this.currentPage(),
      pageSize:    this.pageSize(),
      search:      this.searchQuery(),
      tab:         this.activeTab(),
      newestFirst: this.newestFirst(),
    }),
    loader: ({ request }) => {
      const params = new URLSearchParams({
        pageNumber:  String(request.page),
        pageSize:    String(request.pageSize),
        newestFirst: String(request.newestFirst),
      });
      if (request.search) params.set('search', request.search);
      // API accepts string status: Approved | Rejected | Pending (leave empty for all)
      const statusParam = this.tabToStatusParam(request.tab);
      if (statusParam !== null) params.set('status', statusParam);
      return this.http.get<PaginatedAccountResponse>(`${this.apiUrl}?${params}`);
    }
  });

  private tabToStatusParam(tab: AccountTab): string | null {
    switch (tab) {
      case 'active':   return 'Approved';
      case 'rejected': return 'Rejected';
      // under_review and all: fetch without filter, component filters client-side
      default:         return null;
    }
  }

  readonly rawAccounts = computed(() => this._accountsResource.value()?.data ?? []);
  readonly totalPages   = computed(() => this._accountsResource.value()?.totalPages ?? 1);
  readonly totalCount   = computed(() => this._accountsResource.value()?.totalCount ?? 0);
  readonly isLoading    = this._accountsResource.isLoading;

  readonly accounts = computed<Account[]>(() =>
    this.rawAccounts().map(item => this.mapToAccount(item))
  );

  private mapToAccount(item: AccountItem): Account {
    const isCompany = item.businessType === 'RegisteredEntity';
    const displayName = item.tradeNameAr || item.tradeNameEn || item.tradeName || item.referenceCode;
    return {
      id:               item.accountId,
      name:             displayName,
      type:             isCompany ? 'company' : 'individual',
      status:           this.mapStatus(item.onboardingStatus),
      onboardingStatus: item.onboardingStatus,
      idNumber:         item.referenceCode,
      joinDate:         this.formatDate(item.createdAt),
      propertyCount:    item.propertyCount,
      unit:             isCompany ? 'عقار' : 'مقترات',
      avatarInitials:   this.getInitials(displayName),
    };
  }

  private mapStatus(status: string): 'active' | 'suspended' | 'under_review' | 'rejected' {
    switch (status) {
      case 'Approved': return 'active';
      case 'Rejected': return 'rejected';
      default:         return 'under_review';
    }
  }

  private getInitials(name: string): string {
    if (!name) return 'A';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  private formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: '2-digit' });
  }

  setTab(tab: AccountTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
  }

  setSearch(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(1);
  }

  setNewestFirst(value: boolean): void {
    this.newestFirst.set(value);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
  }
}
