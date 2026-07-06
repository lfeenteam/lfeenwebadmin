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
  PropertyFinalDecisionPayload,
  PropertyFinalDecisionResult,
  PropertyAdminReviewStatusValue
} from '../interfaces/building-card.model';

export interface PropertyTypeItem {
  id: number;
  name: string;
}
import { EMPTY, Observable, forkJoin } from 'rxjs';
import { expand, map, reduce } from 'rxjs/operators';
import { CoreService } from 'src/app/services/core.service';
import { environment } from 'src/environments/environment';

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
      if (request.tab === 'pendingChanges') {
        return this.getMergedPendingChanges(request);
      }

      const params = new URLSearchParams({
        pageNumber: String(request.page),
        pageSize:   String(request.pageSize),
        newestFirst: String(request.newestFirst),
      });
      if (request.search) params.set('search', request.search);
      if (request.city) params.set('city', request.city);
      if (request.propertyTypeId) {
        params.set('propertyTypeId', request.propertyTypeId);
      }
      const statusParam = this.tabToStatusParam(request.tab);
      params.set('status', String(statusParam));
      return this.http.get<PaginatedPropertyResponse>(`${this.apiUrl}?${params}`);
    }
  });

  private tabToStatusParam(tab: BuildingTab): PropertyAdminReviewStatusValue {
    switch (tab) {
      case 'published':   return PropertyAdminReviewStatusValue.Approved;
      case 'new':         return PropertyAdminReviewStatusValue.Pending;
      case 'underReview': return PropertyAdminReviewStatusValue.UnderReview;
      case 'rejected':    return PropertyAdminReviewStatusValue.Rejected;
      case 'pendingChanges': return PropertyAdminReviewStatusValue.HasPendingChanges;
    }
  }

  // The 'pendingChanges' tab covers two distinct statuses (HasPendingChanges and
  // PendingAfterRejection), but the API only filters by a single status per request,
  // so we fetch every page of each status and merge/paginate the combined list client-side.
  private getMergedPendingChanges(request: {
    page: number;
    pageSize: number;
    search: string;
    city: string;
    propertyTypeId: string;
    newestFirst: boolean;
  }): Observable<PaginatedPropertyResponse> {
    const filters = {
      search: request.search,
      city: request.city,
      propertyTypeId: request.propertyTypeId,
      newestFirst: request.newestFirst,
    };

    return forkJoin({
      hasPendingChanges:     this.getAllPropertiesByStatus(PropertyAdminReviewStatusValue.HasPendingChanges, filters),
      pendingAfterRejection: this.getAllPropertiesByStatus(PropertyAdminReviewStatusValue.PendingAfterRejection, filters),
    }).pipe(
      map(({ hasPendingChanges, pendingAfterRejection }) => {
        const merged = [...hasPendingChanges.data, ...pendingAfterRejection.data].sort((a, b) => {
          const diff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
          return request.newestFirst ? diff : -diff;
        });

        const totalCount = merged.length;
        const totalPages = Math.max(1, Math.ceil(totalCount / request.pageSize));
        const start = (request.page - 1) * request.pageSize;

        return {
          data: merged.slice(start, start + request.pageSize),
          totalCount,
          page: request.page,
          nextpage: request.page < totalPages ? request.page + 1 : null,
          totalPages,
          stats: hasPendingChanges.stats,
        };
      })
    );
  }

  private getAllPropertiesByStatus(
    status: PropertyAdminReviewStatusValue,
    filters: { search: string; city: string; propertyTypeId: string; newestFirst: boolean }
  ): Observable<PaginatedPropertyResponse> {
    const fetchPage = (page: number): Observable<PaginatedPropertyResponse> => {
      const params = new URLSearchParams({
        pageNumber: String(page),
        pageSize:   '50',
        newestFirst: String(filters.newestFirst),
        status:     String(status),
      });
      if (filters.search) params.set('search', filters.search);
      if (filters.city) params.set('city', filters.city);
      if (filters.propertyTypeId) params.set('propertyTypeId', filters.propertyTypeId);
      return this.http.get<PaginatedPropertyResponse>(`${this.apiUrl}?${params}`);
    };

    return fetchPage(1).pipe(
      expand(res => res.nextpage != null ? fetchPage(res.nextpage) : EMPTY),
      reduce((acc, res) => ({
        ...res,
        data: [...acc.data, ...res.data],
      }))
    );
  }

  readonly rawProperties = computed(() => this._propertiesResource.value()?.data ?? []);
  readonly totalPages    = computed(() => this._propertiesResource.value()?.totalPages ?? 1);
  readonly totalCount    = computed(() => this._propertiesResource.value()?.totalCount ?? 0);
  readonly isLoading     = this._propertiesResource.isLoading;
  readonly propertyStats = computed<PropertyApiStats | null>(() => this._propertiesResource.value()?.stats ?? null);

  readonly buildings = computed<BuildingCardItem[]>(() =>
    this.rawProperties().map(p => this.mapToBuilding(p))
  );

  private mapToBuilding(p: PropertyApiItem): BuildingCardItem {
    const lang             = this.coreService.getLanguage();
    const occupancyPercent = p.occupancyCount ?? 0;
    const isPendingAfterRejection = this.hasReviewStatus(p, PropertyAdminReviewStatusValue.PendingAfterRejection);
    const isHasPendingChanges     = this.hasReviewStatus(p, PropertyAdminReviewStatusValue.HasPendingChanges);
    const tab: BuildingTab =
      this.hasReviewStatus(p, PropertyAdminReviewStatusValue.Approved) ? 'published' :
      this.hasReviewStatus(p, PropertyAdminReviewStatusValue.Rejected) ? 'rejected'  :
      (isHasPendingChanges || isPendingAfterRejection)                 ? 'pendingChanges' :
      this.hasReviewStatus(p, PropertyAdminReviewStatusValue.UnderReview) ? 'underReview' : 'new';
    const location         = [p.city, p.district].filter(Boolean).join(' - ');

    return {
      id:         String(p.propertyId),
      title:      p.name,
      host:       p.accountName ?? '',
      location,
      status:     p.isActive ? 'active' : 'stopped',
      typeLabel:  p.propertyTypeName,
      units:      p.unitCount,
      occupancy:  occupancyPercent,
      bookings:   p.activeBookingsCount,
      lastUpdate: this.formatDate(p.updatedAt, lang),
      tab,
      mainPhotoUrl: p.mainPhotoUrl,
      pendingChangesReason: isPendingAfterRejection ? 'pendingAfterRejection' : isHasPendingChanges ? 'hasPendingChanges' : undefined,
    };
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
    return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', {
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
