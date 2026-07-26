import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { rxResource, toObservable } from '@angular/core/rxjs-interop';
import { BehaviorSubject, EMPTY, Observable, forkJoin } from 'rxjs';
import { catchError, expand, map, reduce } from 'rxjs/operators';
import { AccountItem, PaginatedAccountResponse } from '../interfaces/account.model';
import { PaginatedPropertyResponse } from '../interfaces/building-card.model';
import {
  BuildingWithUnits,
  UnitCardItem,
  UnitApiItem,
  UnitApiStats,
  UnitApiDetailItem,
  UnitBasicDataResponse,
  UnitTermsResponse,
  UnitAccessResponse,
  UnitPhotosResponse,
  PaginatedUnitResponse,
  UnitStatus,
  UnitTab,
  UnitPricingResponse,
  UnitPricingCalendarResponse,
  UnitCancellationPolicyResponse,
  UnitDepositResponse,
  UnitServicesResponse,
  UnitLicenseResponse,
} from '../interfaces/unit-card.model';
import { CoreService } from 'src/app/services/core.service';
import { environment } from 'src/environments/environment';

export type UnitReviewDecision = 'approved' | 'rejected';
export type UnitSortOrder = 'newest' | 'oldest' | 'highestOccupancy';

export interface FilterItem {
  value: string;
  labelKey: string;
}

@Injectable({ providedIn: 'root' })
export class UnitsService {
  private http = inject(HttpClient);
  private coreService = inject(CoreService);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/units`;
  private readonly accountsApiUrl = `${environment.apiBaseUrl}/api/accounts`;
  private readonly propertiesApiUrl = `${environment.apiBaseUrl}/api/properties`;
  private readonly defaultBuildingImage = '';

  readonly searchQuery  = signal('');
  readonly activeTab    = signal<UnitTab>('new');
  readonly accountId    = signal('');
  readonly propertyId   = signal('');
  readonly sortOrder    = signal<UnitSortOrder>('newest');
  readonly buildingsPage = signal(1);

  private readonly _unitsResource = rxResource({
    request: () => ({
      search:     this.searchQuery(),
      accountId:  this.accountId(),
      propertyId: this.propertyId(),
      tab:        this.activeTab(),
      sort:       this.sortOrder(),
      page:       this.buildingsPage(),
    }),
    loader: ({ request }) => {
      const newestFirst = request.sort !== 'oldest';

      // 'draft' has no distinct backend status yet (status=0 still returns Pending-status
      // units), so per the same decision made for properties, we trust the request itself
      // and label whatever comes back as Draft rather than cross-checking reviewStatus.
      if (request.tab === 'draft') {
        return this.fetchUnitsPage({ ...request, status: 0, newestFirst });
      }

      // The 'pendingChanges' tab covers two distinct statuses (HasPendingChanges and
      // PendingAfterRejection). There's no single backend query for "either of these two
      // statuses" with real pagination, so this tab still pulls everything for both statuses
      // and merges client-side — it's a much smaller dataset than the other tabs in practice.
      if (request.tab === 'pendingChanges') {
        return forkJoin([
          this.getAllUnitPages({ ...request, status: 5, newestFirst }),
          this.getAllUnitPages({ ...request, status: 6, newestFirst }),
        ]).pipe(
          map(([hasPendingChanges, pendingAfterRejection]) => ({
            ...hasPendingChanges,
            data: [...hasPendingChanges.data, ...pendingAfterRejection.data].filter(u =>
              this.isReviewStatus(u, 5) || this.isReviewStatus(u, 6)
            ),
            totalCount: hasPendingChanges.totalCount + pendingAfterRejection.totalCount,
          }))
        );
      }

      const status = this.tabToStatus(request.tab)!;
      return this.fetchUnitsPage({
        ...request,
        status,
        newestFirst,
      }).pipe(
        // Defensive: only keep units whose actual reviewStatus matches this tab, in case
        // the backend's numeric `status` filter drifts out of sync with our enum again.
        map(res => ({
          ...res,
          data: res.data.filter(u => this.isReviewStatus(u, status)),
        }))
      );
    }
  });

  private readonly _statsResource = rxResource({
    request: () => true,
    loader: () => this.http.get<PaginatedUnitResponse>(`${this.apiUrl}?pageNumber=1&pageSize=1&newestFirst=true`)
  });

  private readonly _accountsFilterResource = rxResource({
    request: () => true,
    loader: () => this.getAllAccountPages()
  });
  private readonly _propertiesFilterResource = rxResource({
    request: () => true,
    loader: () => this.getAllPropertyPages()
  });

  readonly rawUnits = computed(() => {
    const data = this._unitsResource.value()?.data ?? [];
    if (this.sortOrder() === 'highestOccupancy') {
      return [...data].sort((a, b) => (b.maxGuests ?? 0) - (a.maxGuests ?? 0));
    }
    return data;
  });
  readonly rawAccounts = computed(() => this._accountsFilterResource.value()?.data ?? []);
  readonly rawProperties = computed(() => this._propertiesFilterResource.value()?.data ?? []);
  readonly propertyMainPhotoMap = computed(() => {
    const mapByPropertyId = new Map<number, string>();
    for (const property of this.rawProperties()) {
      if (property.mainPhotoUrl) {
        mapByPropertyId.set(property.propertyId, property.mainPhotoUrl);
      }
    }
    return mapByPropertyId;
  });
  readonly totalCount = computed(() => this._unitsResource.value()?.totalCount ?? 0);
  readonly isLoading  = this._unitsResource.isLoading;
  readonly unitStats  = computed<UnitApiStats | null>(() => this._statsResource.value()?.stats ?? null);

  readonly buildingsWithUnitsSignal = computed<BuildingWithUnits[]>(() => {
    const groups = new Map<number, BuildingWithUnits>();
    for (const u of this.rawUnits()) {
      if (!groups.has(u.propertyId)) {
        groups.set(u.propertyId, {
          id:                  String(u.propertyId),
          name:                u.propertyName,
          location:            '',
          publishedUnits:      0,
          image:               this.getBuildingImage(u),
          units:               [],
    needsPropertyReview: !['Approved'].includes(u.propertyAdminReviewStatus ?? ''),
        });
      }
      const g = groups.get(u.propertyId)!;
      const currentPriority = this.getImagePriority(g.image);
      const candidateImage = this.getBuildingImage(u);
      const candidatePriority = this.getImagePriority(candidateImage);
      if (candidatePriority > currentPriority) {
        g.image = candidateImage;
      }
      g.units.push(this.mapToUnitCard(u));
      g.publishedUnits = g.units.length;
    }
    return Array.from(groups.values());
  });

  private getBuildingImage(unit: UnitApiItem): string {
    return this.propertyMainPhotoMap().get(unit.propertyId)
      ?? unit.mainPhotoUrl
      ?? unit.accountLogoUrl
      ?? this.defaultBuildingImage;
  }

  private getImagePriority(image: string): number {
    if (!image || image === this.defaultBuildingImage) return 0;
    if (image.includes('/account-logos/')) return 1;
    return 2;
  }

  readonly propertiesForFilter = computed<FilterItem[]>(() => {
    const seen = new Map<number, FilterItem>();
    for (const p of this.rawProperties()) {
      if (!seen.has(p.propertyId)) {
        seen.set(p.propertyId, { value: String(p.propertyId), labelKey: p.name });
      }
    }
    return Array.from(seen.values());
  });

  readonly accountsForFilter = computed<FilterItem[]>(() => {
    const seen = new Map<string, FilterItem>();
    const lang = this.coreService.getOptionsSignal()().language;
    for (const account of this.rawAccounts()) {
      if (!seen.has(account.accountId)) {
        seen.set(account.accountId, {
          value: account.accountId,
          labelKey: this.getAccountDisplayName(account, lang),
        });
      }
    }
    return Array.from(seen.values());
  });

  readonly totalBuildingPages = computed(() => this._unitsResource.value()?.totalPages ?? 1);

  readonly paginatedBuildings = computed<BuildingWithUnits[]>(() => this.buildingsWithUnitsSignal());

  // Fetches exactly the page the backend reports (page/totalPages/nextpage passed through
  // untouched), so the UI's pagination controls drive real server-side pagination instead
  // of pulling every page up front just to slice it client-side.
  private fetchUnitsPage(filters: {
    search?: string;
    accountId?: string;
    propertyId?: string;
    status?: number | string;
    newestFirst?: boolean;
    page: number;
  }): Observable<PaginatedUnitResponse> {
    const params = new URLSearchParams({
      pageNumber:  String(filters.page),
      pageSize:    '20',
      newestFirst: filters.newestFirst === false ? 'false' : 'true',
    });
    if (filters.search)              params.set('search',     filters.search);
    if (filters.accountId)           params.set('accountId',  filters.accountId);
    if (filters.propertyId)          params.set('propertyId', filters.propertyId);
    if (filters.status !== undefined) params.set('status',    String(filters.status));
    return this.http.get<PaginatedUnitResponse>(`${this.apiUrl}?${params}`);
  }

  private getAllUnitPages(filters: {
    search?: string;
    accountId?: string;
    propertyId?: string;
    status?: number | string;
    newestFirst?: boolean;
  }): Observable<PaginatedUnitResponse> {
    const fetchPage = (page: number): Observable<PaginatedUnitResponse> => {
      const params = new URLSearchParams({
        pageNumber:  String(page),
        pageSize:    '20',
        newestFirst: filters.newestFirst === false ? 'false' : 'true',
      });
      if (filters.search)              params.set('search',     filters.search);
      if (filters.accountId)           params.set('accountId',  filters.accountId);
      if (filters.propertyId)          params.set('propertyId', filters.propertyId);
      if (filters.status !== undefined) params.set('status',    String(filters.status));
      return this.http.get<PaginatedUnitResponse>(`${this.apiUrl}?${params}`);
    };

    return fetchPage(1).pipe(
      // If a later page fails (e.g. a transient gateway error), stop paginating and
      // keep whatever pages already succeeded instead of losing the whole list.
      expand(res => res.nextpage != null ? fetchPage(res.nextpage).pipe(catchError(() => EMPTY)) : EMPTY),
      reduce((acc, res) => ({
        ...res,
        data: [...acc.data, ...res.data],
        totalPages: 1,
        page: 1,
      }))
    );
  }

  private getAllAccountPages(): Observable<PaginatedAccountResponse> {
    const fetchPage = (page: number): Observable<PaginatedAccountResponse> => {
      const params = new URLSearchParams({
        pageNumber:  String(page),
        pageSize:    '50',
        newestFirst: 'true',
      });
      return this.http.get<PaginatedAccountResponse>(`${this.accountsApiUrl}?${params}`);
    };

    return fetchPage(1).pipe(
      // If a later page fails (e.g. a transient gateway error), stop paginating and
      // keep whatever pages already succeeded instead of losing the whole list.
      expand(res => res.nextpage != null ? fetchPage(res.nextpage).pipe(catchError(() => EMPTY)) : EMPTY),
      reduce((acc, res) => ({
        ...res,
        data: [...acc.data, ...res.data],
        totalPages: 1,
        page: 1,
      }))
    );
  }

  private getAllPropertyPages(): Observable<PaginatedPropertyResponse> {
    const fetchPage = (page: number): Observable<PaginatedPropertyResponse> => {
      const params = new URLSearchParams({
        pageNumber:  String(page),
        pageSize:    '50',
        newestFirst: 'true',
      });
      return this.http.get<PaginatedPropertyResponse>(`${this.propertiesApiUrl}?${params}`);
    };

    return fetchPage(1).pipe(
      // If a later page fails (e.g. a transient gateway error), stop paginating and
      // keep whatever pages already succeeded instead of losing the whole list.
      expand(res => res.nextpage != null ? fetchPage(res.nextpage).pipe(catchError(() => EMPTY)) : EMPTY),
      reduce((acc, res) => ({
        ...res,
        data: [...acc.data, ...res.data],
        totalPages: 1,
        page: 1,
      }))
    );
  }

  private getAccountDisplayName(account: AccountItem, lang: string): string {
    return (lang === 'ar' ? account.tradeNameAr : account.tradeNameEn)
      || account.tradeName
      || account.tradeNameAr
      || account.tradeNameEn
      || account.referenceCode;
  }

  // 0=Draft, 1=Pending, 2=UnderReview, 3=Approved, 4=Rejected, 5=HasPendingChanges, 6=PendingAfterRejection
  private tabToStatus(tab: UnitTab): number | undefined {
    switch (tab) {
      case 'draft':          return 0;
      case 'new':            return 1;
      case 'underReview':    return 2;
      case 'published':      return 3;
      case 'rejected':       return 4;
      case 'pendingChanges': return 5;
    }
  }

  private readonly _buildingsObs$: Observable<BuildingWithUnits[]>;

  constructor() {
    this._buildingsObs$ = toObservable(this.buildingsWithUnitsSignal);
  }

  getBuildingsWithUnits(): Observable<BuildingWithUnits[]> {
    return this._buildingsObs$;
  }

  getUnitById(unitId: string): Observable<UnitApiDetailItem> {
    return this.http.get<UnitApiDetailItem>(`${this.apiUrl}/${unitId}`);
  }

  getUnitBasicData(unitId: string): Observable<UnitBasicDataResponse> {
    return this.http.get<UnitBasicDataResponse>(`${this.apiUrl}/${unitId}/basic-data`);
  }

  getUnitTerms(unitId: string): Observable<UnitTermsResponse> {
    return this.http.get<UnitTermsResponse>(`${this.apiUrl}/${unitId}/terms`);
  }

  getUnitAccess(unitId: string): Observable<UnitAccessResponse> {
    return this.http.get<UnitAccessResponse>(`${this.apiUrl}/${unitId}/access`);
  }

  getUnitPhotos(unitId: string): Observable<UnitPhotosResponse> {
    return this.http.get<UnitPhotosResponse>(`${this.apiUrl}/${unitId}/photos`);
  }

  getUnitPricing(unitId: string): Observable<UnitPricingResponse> {
    return this.http.get<UnitPricingResponse>(`${this.apiUrl}/${unitId}/pricing`);
  }

  getUnitPricingCalendar(unitId: string, date: string): Observable<UnitPricingCalendarResponse> {
    return this.http.get<UnitPricingCalendarResponse>(
      `${this.apiUrl}/${unitId}/pricing/calendar?date=${date}`
    );
  }

  reviewUnitPricing(unitId: string, decision: 'Approved' | 'Rejected', rejectionReason: string | null): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${unitId}/pricing/review`, { decision, rejectionReason });
  }

  reviewUnitBasicData(unitId: string, decision: 'Approved' | 'Rejected', rejectionReason: string | null): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${unitId}/basic-data/review`, { decision, rejectionReason });
  }

  getUnitCancellationPolicy(unitId: string): Observable<UnitCancellationPolicyResponse> {
    return this.http.get<UnitCancellationPolicyResponse>(`${this.apiUrl}/${unitId}/cancellation-policy`);
  }

  reviewUnitCancellationPolicy(unitId: string, decision: 'Approved' | 'Rejected', rejectionReason: string | null): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${unitId}/cancellation-policy/review`, { decision, rejectionReason });
  }

  getUnitDeposit(unitId: string): Observable<UnitDepositResponse> {
    return this.http.get<UnitDepositResponse>(`${this.apiUrl}/${unitId}/deposit`);
  }

  reviewUnitDeposit(unitId: string, decision: 'Approved' | 'Rejected', rejectionReason: string | null): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${unitId}/deposit/review`, { decision, rejectionReason });
  }

  reviewUnitTerms(unitId: string, decision: 'Approved' | 'Rejected', rejectionReason: string | null): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${unitId}/terms/review`, { decision, rejectionReason });
  }

  getUnitServices(unitId: string): Observable<UnitServicesResponse> {
    return this.http.get<UnitServicesResponse>(`${this.apiUrl}/${unitId}/services`);
  }

  reviewUnitServices(unitId: string, decision: 'Approved' | 'Rejected', rejectionReason: string | null): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${unitId}/services/review`, { decision, rejectionReason });
  }

  getUnitLicense(unitId: string): Observable<UnitLicenseResponse> {
    return this.http.get<UnitLicenseResponse>(`${this.apiUrl}/${unitId}/license`);
  }

  reviewUnitLicense(unitId: string, decision: 'Approved' | 'Rejected', rejectionReason: string | null): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${unitId}/license/review`, { decision, rejectionReason });
  }

  approveUnit(unitId: string, finalNotes: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${unitId}/approve`, { finalNotes });
  }

  rejectUnit(unitId: string, finalNotes: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${unitId}/reject`, { finalNotes });
  }

  reviewUnitAccess(
    unitId: string,
    body: {
      decision: string;
      rejectionReason: string | null;
      photos: { category: string; decision: string; rejectionReason: string | null }[];
    }
  ): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${unitId}/access/review`, body);
  }

  reviewUnitPhotos(
    unitId: string,
    body: {
      photos: { mediaId: number; decision: string; rejectionReason: string | null }[];
      decision: string;
      rejectionReason: string | null;
    }
  ): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${unitId}/photos/review`, body);
  }

  private mapToUnitCard(u: UnitApiItem): UnitCardItem {
    const lang = this.coreService.getOptionsSignal()().language;
    return {
      id:          String(u.unitId),
      unitNumber:  String(u.apartmentNumberInFloor),
      title:       u.name ?? `${u.unitTypeName} ${u.apartmentNumberInFloor}`,
      floor:       lang === 'ar' ? `الدور ${u.floorNumber}` : `Floor ${u.floorNumber}`,
      capacity:    u.maxGuests != null
        ? (lang === 'ar' ? `سعة ${u.maxGuests} أفراد` : `${u.maxGuests} guests`)
        : '—',
      status:      this.resolveUnitStatus(u),
      type:        u.unitTypeName,
      description: u.description ?? '',
      district:    u.district ?? null,
      rooms:       0,
      hasPool:     false,
    };
  }

  private resolveUnitStatus(u: UnitApiItem): UnitStatus {
    if (this.activeTab() === 'pendingChanges') {
      return this.isReviewStatus(u, 6) ? 'pendingAfterRejection' : 'pendingChanges';
    }
    return this.tabToUnitStatus(this.activeTab());
  }

  // 0=Draft, 1=Pending, 2=UnderReview, 3=Approved, 4=Rejected, 5=HasPendingChanges, 6=PendingAfterRejection
  private isReviewStatus(u: UnitApiItem, status: number): boolean {
    if (typeof u.reviewStatus === 'number') return u.reviewStatus === status;
    const names: Record<number, string> = {
      0: 'Draft', 1: 'Pending', 2: 'UnderReview', 3: 'Approved', 4: 'Rejected', 5: 'HasPendingChanges', 6: 'PendingAfterRejection',
    };
    return u.reviewStatus === names[status];
  }

  private tabToUnitStatus(tab: UnitTab): UnitStatus {
    switch (tab) {
      case 'draft':          return 'draft';
      case 'published':      return 'active';
      case 'new':            return 'pending';
      case 'underReview':    return 'underReview';
      case 'rejected':       return 'stopped';
      case 'pendingChanges': return 'pendingChanges';
    }
  }

  private reviewDecisionsSubject = new BehaviorSubject<Record<string, UnitReviewDecision>>({});

  getReviewDecisions(): Observable<Record<string, UnitReviewDecision>> {
    return this.reviewDecisionsSubject.asObservable();
  }

  setReviewDecision(buildingId: string, unitId: string, sectionKey: string, decision: UnitReviewDecision): void {
    const key = `${buildingId}:${unitId}:${sectionKey}`;
    this.reviewDecisionsSubject.next({ ...this.reviewDecisionsSubject.value, [key]: decision });
  }

  getReviewDecision(buildingId: string, unitId: string, sectionKey: string): UnitReviewDecision | undefined {
    return this.reviewDecisionsSubject.value[`${buildingId}:${unitId}:${sectionKey}`];
  }

  setTab(tab: UnitTab): void {
    this.activeTab.set(tab);
    this.buildingsPage.set(1);
  }

  setSearch(query: string): void {
    this.searchQuery.set(query);
    this.buildingsPage.set(1);
  }

  setSortOrder(order: UnitSortOrder): void {
    this.sortOrder.set(order);
    this.buildingsPage.set(1);
  }

  setAccountFilter(id: string): void {
    this.accountId.set(id);
    this.buildingsPage.set(1);
  }

  setPropertyFilter(id: string): void {
    this.propertyId.set(id);
    this.buildingsPage.set(1);
  }

  goToBuildingPage(page: number): void {
    this.buildingsPage.set(page);
  }
}
