import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { rxResource } from '@angular/core/rxjs-interop';
import { AccountItem, AccountStats, PaginatedAccountResponse, Account, AccountDetail } from '../interfaces/account.model';
import { AccountTab } from '../pages-d3/account-management/components/account-tabs-bar/account-tabs-bar.component';
import { CoreService } from 'src/app/services/core.service';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private http = inject(HttpClient);
  private coreService = inject(CoreService);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/accounts`;

  readonly currentPage  = signal(1);
  readonly pageSize     = signal(15);
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
      lang:        this.coreService.getOptionsSignal()().language,
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

  // Draft=0 | PendingReview=1 | Approved=2 | Rejected=3
  private tabToStatusParam(tab: AccountTab): string | null {
    switch (tab) {
      case 'active':   return '2';
      case 'rejected': return '3';
      // under_review (Draft=0 + PendingReview=1) and all: fetch without filter, filter client-side
      default:         return null;
    }
  }

  readonly rawAccounts = computed(() => this._accountsResource.value()?.data ?? []);
  readonly totalPages   = computed(() => this._accountsResource.value()?.totalPages ?? 1);
  readonly totalCount   = computed(() => this._accountsResource.value()?.totalCount ?? 0);
  readonly isLoading    = this._accountsResource.isLoading;
  readonly accountStats = computed<AccountStats | null>(() => this._accountsResource.value()?.stats ?? null);

  readonly accounts = computed<Account[]>(() =>
    this.rawAccounts().map(item => this.mapToAccount(item))
  );

  private mapToAccount(item: AccountItem): Account {
    const isCompany = item.businessType === 'RegisteredEntity';
    const lang = this.coreService.getLanguage();
    const displayName = (lang === 'ar' ? item.tradeNameAr : item.tradeNameEn)
      || item.tradeName
      || item.tradeNameAr
      || item.tradeNameEn
      || item.referenceCode;
    return {
      id:               item.accountId,
      name:             displayName,
      type:             isCompany ? 'company' : 'individual',
      status:           this.mapStatus(item.onboardingStatus),
      onboardingStatus: item.onboardingStatus,
      idNumber:         item.referenceCode,
      joinDate:         this.formatDate(item.createdAt, lang),
      propertyCount:    item.propertyCount,
      unit:             'عقار',
      avatarInitials:   this.getInitials(displayName),
      logoUrl:          item.logoUrl,
    };
  }

  private mapStatus(status: string): 'active' | 'suspended' | 'under_review' | 'rejected' {
    switch (status) {
      case 'Approved':      return 'active';
      case 'Rejected':      return 'rejected';
      case 'Draft':
      case 'PendingReview': return 'under_review';
      default:              return 'under_review';
    }
  }

  private getInitials(name: string): string {
    if (!name) return 'A';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  private formatDate(dateStr: string, lang: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: '2-digit'
    });
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

  getStatusCount(status: number | null): Observable<number> {
    const params = new URLSearchParams({ pageNumber: '1', pageSize: '1' });
    if (status !== null) params.set('status', String(status));
    return this.http.get<PaginatedAccountResponse>(`${this.apiUrl}?${params}`).pipe(
      map(res => res.totalCount)
    );
  }

  getAccountById(id: string): Observable<AccountDetail> {
    return this.http.get<AccountDetail>(`${this.apiUrl}/${id}`);
  }

  acceptAccount(id: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/accept`, {});
  }

  rejectAccount(id: string, rejectionReason: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/reject`, { rejectionReason });
  }
}
