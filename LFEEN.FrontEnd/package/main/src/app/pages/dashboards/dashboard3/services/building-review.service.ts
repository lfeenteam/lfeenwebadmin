import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  BuildingCardItem,
  BuildingTab,
  PropertyApiItem,
  PropertyApiStats,
  PaginatedPropertyResponse,
  PropertyDetailResponse,
  PropertyPhotosResponse,
  PhotoReviewPayload,
  PhotoReviewResponse,
  PropertyTermsResponse,
  TermsReviewPayload,
  TermsReviewResponse,
  PropertyLicenseResponse,
  LicenseReviewPayload,
  LicenseReviewResponse,
  PropertyBasicDataResponse,
  BasicDataReviewPayload,
  BasicDataReviewResponse,
  PropertyLocationResponse,
  LocationReviewPayload,
  LocationReviewResponse,
  PropertyFinalDecisionPayload,
  PropertyFinalDecisionResult,
  PropertyAdminReviewStatus,
  PropertyAdminReviewStatusValue
} from '../interfaces/building-card.model';

export interface PropertyTypeItem {
  id: number;
  name: string;
  iconKey?: string | null;
  iconUrl?: string | null;
}
import { EMPTY, Observable, forkJoin } from 'rxjs';
import { expand, map, reduce } from 'rxjs/operators';
import { CoreService } from 'src/app/services/core.service';
import { environment } from 'src/environments/environment';
import { appLocale } from 'src/app/utils/locale-format.util';

@Injectable({ providedIn: 'root' })
export class BuildingReviewService {
  private http        = inject(HttpClient);
  private coreService = inject(CoreService);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/properties`;

  readonly currentPage = signal(1);
  readonly pageSize    = signal(18);
  readonly searchQuery = signal('');
  readonly activeTab   = signal<BuildingTab>('published');
  readonly city        = signal('');
  readonly propertyTypeId = signal('');
  readonly newestFirst = signal(true);

  // The backend filters by status name, so every tab is a single server-paginated request.
  private readonly tabStatus: Record<Exclude<BuildingTab, 'pendingChanges'>, PropertyAdminReviewStatus> = {
    draft:       'Draft',
    new:         'Pending',
    underReview: 'UnderReview',
    published:   'Approved',
    rejected:    'Rejected',
    banned:      'Banned',
  };

  private readonly _propertiesResource = rxResource({
    request: () => ({
      page:     this.currentPage(),
      pageSize: this.pageSize(),
      search:   this.searchQuery(),
      tab:      this.activeTab(),
      city:     this.city(),
      propertyTypeId: this.propertyTypeId(),
      newestFirst: this.newestFirst(),
    }),
    loader: ({ request }) => {
      const filters = {
        search: request.search,
        city: request.city,
        propertyTypeId: request.propertyTypeId,
        newestFirst: request.newestFirst,
      };

      if (request.tab !== 'pendingChanges') {
        return this.fetchPropertiesPage(request.page, request.pageSize, filters, this.tabStatus[request.tab]);
      }

      // 'pendingChanges' spans two statuses and the backend takes one per request, so this
      // (small) tab pulls both lists and paginates client-side.
      return forkJoin([
        this.getAllProperties(filters, 'HasPendingChanges'),
        this.getAllProperties(filters, 'PendingAfterRejection'),
      ]).pipe(
        map(([hasPendingChanges, pendingAfterRejection]) => {
          const matching   = [...hasPendingChanges.data, ...pendingAfterRejection.data];
          const totalCount = matching.length;
          const totalPages = Math.max(1, Math.ceil(totalCount / request.pageSize));
          const start      = (request.page - 1) * request.pageSize;

          return {
            ...hasPendingChanges,
            data: matching.slice(start, start + request.pageSize),
            totalCount,
            page: request.page,
            nextpage: request.page < totalPages ? request.page + 1 : null,
            totalPages,
          };
        })
      );
    }
  });

  private fetchPropertiesPage(
    page: number,
    pageSize: number | string,
    filters: { search: string; city: string; propertyTypeId: string; newestFirst: boolean },
    status: PropertyAdminReviewStatus
  ): Observable<PaginatedPropertyResponse> {
    const params = new URLSearchParams({
      pageNumber: String(page),
      pageSize:   String(pageSize),
      newestFirst: String(filters.newestFirst),
      status,
    });
    if (filters.search) params.set('search', filters.search);
    if (filters.city) params.set('city', filters.city);
    if (filters.propertyTypeId) params.set('propertyTypeId', filters.propertyTypeId);
    return this.http.get<PaginatedPropertyResponse>(`${this.apiUrl}?${params}`);
  }

  private getAllProperties(
    filters: { search: string; city: string; propertyTypeId: string; newestFirst: boolean },
    status: PropertyAdminReviewStatus
  ): Observable<PaginatedPropertyResponse> {
    return this.fetchPropertiesPage(1, 50, filters, status).pipe(
      expand(res => res.nextpage != null ? this.fetchPropertiesPage(res.nextpage, 50, filters, status) : EMPTY),
      reduce((acc, res) => ({
        ...res,
        data: [...acc.data, ...res.data],
      }))
    );
  }

  private resolveTab(p: PropertyApiItem): BuildingTab {
    const isPendingAfterRejection = this.hasReviewStatus(p, PropertyAdminReviewStatusValue.PendingAfterRejection);
    const isHasPendingChanges     = this.hasReviewStatus(p, PropertyAdminReviewStatusValue.HasPendingChanges);
    return (
      this.isBanned(p)                                                 ? 'banned' :
      this.hasReviewStatus(p, PropertyAdminReviewStatusValue.Draft)    ? 'draft' :
      this.hasReviewStatus(p, PropertyAdminReviewStatusValue.Approved) ? 'published' :
      this.hasReviewStatus(p, PropertyAdminReviewStatusValue.Rejected) ? 'rejected'  :
      (isHasPendingChanges || isPendingAfterRejection)                 ? 'pendingChanges' :
      this.hasReviewStatus(p, PropertyAdminReviewStatusValue.UnderReview) ? 'underReview' : 'new'
    );
  }

  readonly rawProperties = computed(() => this._propertiesResource.value()?.data ?? []);
  readonly totalPages    = computed(() => this._propertiesResource.value()?.totalPages ?? 1);
  readonly totalCount    = computed(() => this._propertiesResource.value()?.totalCount ?? 0);
  readonly isLoading     = this._propertiesResource.isLoading;
  // The backend returns global stats on every list response, regardless of status/filters.
  readonly propertyStats = computed<PropertyApiStats | null>(() => this._propertiesResource.value()?.stats ?? null);

  readonly buildings = computed<BuildingCardItem[]>(() =>
    this.rawProperties().map(p => this.mapToBuilding(p))
  );

  private mapToBuilding(p: PropertyApiItem): BuildingCardItem {
    const lang             = this.coreService.getLanguage();
    const occupancyPercent = p.occupancyCount ?? 0;
    const isPendingAfterRejection = this.hasReviewStatus(p, PropertyAdminReviewStatusValue.PendingAfterRejection);
    const isHasPendingChanges     = this.hasReviewStatus(p, PropertyAdminReviewStatusValue.HasPendingChanges);
    // The 'draft' tab fetches by `status=0` directly (see _propertiesResource) rather
    // than classifying by reviewStatus, so trust that request context here too.
    const tab: BuildingTab = this.activeTab() === 'draft' ? 'draft' : this.resolveTab(p);
    const location         = [p.city, p.district].filter(Boolean).join(' - ');

    return {
      id:         String(p.propertyId),
      title:      p.name,
      host:       p.accountName ?? '',
      location,
      status:     p.isActive ? 'active' : 'stopped',
      typeLabel:  p.propertyTypeName,
      typeIconKey: p.propertyTypeIconKey ?? null,
      typeIconUrl: p.propertyTypeIconUrl ?? null,
      units:      p.unitCount,
      occupancy:  occupancyPercent,
      bookings:   p.activeBookingsCount,
      lastUpdate: this.formatDate(p.updatedAt, lang),
      tab,
      mainPhotoUrl: p.mainPhotoUrl,
      pendingChangesReason: isPendingAfterRejection ? 'pendingAfterRejection' : isHasPendingChanges ? 'hasPendingChanges' : undefined,
      canBan: tab !== 'draft' && (
        isHasPendingChanges ||
        this.hasReviewStatus(p, PropertyAdminReviewStatusValue.Approved) ||
        this.hasReviewStatus(p, PropertyAdminReviewStatusValue.UnderReview)
      ),
      banReason: p.banReason ?? null,
      bannedAt:  p.bannedAt ?? null,
    };
  }

  // Checked before every other status: a banned property must never be classified by its sections.
  private isBanned(property: PropertyApiItem): boolean {
    return property.reviewStatus === 'Banned';
  }

  private hasReviewStatus(
    property: PropertyApiItem,
    status: PropertyAdminReviewStatusValue
  ): boolean {
    if (typeof property.reviewStatus === 'number') {
      return property.reviewStatus === status;
    }

    return property.reviewStatus === PropertyAdminReviewStatusValue[status];
  }

  private formatDate(dateStr: string, lang: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString(appLocale(lang), {
      day: 'numeric', month: 'long', year: '2-digit'
    });
  }

  setTab(tab: BuildingTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
  }

  setSearch(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(1);
  }

  setFilters(filters: {
    city?: string;
    propertyTypeId?: string;
    newestFirst?: boolean;
  }): void {
    this.city.set(filters.city ?? '');
    this.propertyTypeId.set(filters.propertyTypeId ?? '');
    this.newestFirst.set(filters.newestFirst ?? true);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
  }

  /** Refetches the current list and stats, e.g. after a ban changed a property's status. */
  reload(): void {
    this._propertiesResource.reload();
  }

  getBuildingById(id: string): BuildingCardItem | undefined {
    return this.buildings().find(b => b.id === id);
  }

  getPropertyById(id: string): Observable<PropertyDetailResponse> {
    return this.http.get<PropertyDetailResponse>(`${this.apiUrl}/${id}`);
  }

  getPropertyPhotos(id: string): Observable<PropertyPhotosResponse> {
    return this.http.get<PropertyPhotosResponse>(`${this.apiUrl}/${id}/photos`);
  }

  submitPhotosReview(id: string, payload: PhotoReviewPayload): Observable<PhotoReviewResponse> {
    return this.http.post<PhotoReviewResponse>(`${this.apiUrl}/${id}/photos/review`, payload);
  }

  getPropertyTerms(id: string): Observable<PropertyTermsResponse> {
    return this.http.get<PropertyTermsResponse>(`${this.apiUrl}/${id}/terms`);
  }

  submitTermsReview(id: string, payload: TermsReviewPayload): Observable<TermsReviewResponse> {
    return this.http.post<TermsReviewResponse>(`${this.apiUrl}/${id}/terms/review`, payload);
  }

  getPropertyLicense(id: string): Observable<PropertyLicenseResponse> {
    return this.http.get<PropertyLicenseResponse>(`${this.apiUrl}/${id}/license`);
  }

  submitLicenseReview(id: string, payload: LicenseReviewPayload): Observable<LicenseReviewResponse> {
    return this.http.post<LicenseReviewResponse>(`${this.apiUrl}/${id}/license/review`, payload);
  }

  getPropertyBasicData(id: string): Observable<PropertyBasicDataResponse> {
    return this.http.get<PropertyBasicDataResponse>(`${this.apiUrl}/${id}/basic-data`);
  }

  submitBasicDataReview(id: string, payload: BasicDataReviewPayload): Observable<BasicDataReviewResponse> {
    return this.http.post<BasicDataReviewResponse>(`${this.apiUrl}/${id}/basic-data/review`, payload);
  }

  getPropertyLocation(id: string): Observable<PropertyLocationResponse> {
    return this.http.get<PropertyLocationResponse>(`${this.apiUrl}/${id}/location`);
  }

  submitLocationReview(id: string, payload: LocationReviewPayload): Observable<LocationReviewResponse> {
    return this.http.post<LocationReviewResponse>(`${this.apiUrl}/${id}/location/review`, payload);
  }

  approveBuilding(id: string, payload: PropertyFinalDecisionPayload): Observable<PropertyFinalDecisionResult> {
    return this.http.post<PropertyFinalDecisionResult>(`${this.apiUrl}/${id}/approve`, payload);
  }

  rejectBuilding(id: string, payload: PropertyFinalDecisionPayload): Observable<PropertyFinalDecisionResult> {
    return this.http.post<PropertyFinalDecisionResult>(`${this.apiUrl}/${id}/reject`, payload);
  }

  getCities(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/cities`);
  }

  getPropertyTypes(): Observable<PropertyTypeItem[]> {
    return this.http.get<PropertyTypeItem[]>(`${this.apiUrl}/types`);
  }
}
