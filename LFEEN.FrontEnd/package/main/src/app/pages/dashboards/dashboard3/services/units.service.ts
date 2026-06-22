import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { rxResource, toObservable } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  BuildingWithUnits,
  UnitCardItem,
  UnitApiItem,
  UnitApiDetailItem,
  PaginatedUnitResponse,
  UnitStatus,
  UnitTab
} from '../interfaces/unit-card.model';

export type UnitReviewDecision = 'approved' | 'rejected';

@Injectable({ providedIn: 'root' })
export class UnitsService {
  private http = inject(HttpClient);
  private readonly apiUrl = 'https://test-api-admin.lfeen.com/api/units';

  readonly currentPage = signal(1);
  readonly pageSize    = signal(15);
  readonly searchQuery = signal('');
  readonly activeTab   = signal<UnitTab>('new');

  private readonly _unitsResource = rxResource({
    request: () => ({
      page:     this.currentPage(),
      pageSize: this.pageSize(),
      search:   this.searchQuery(),
    }),
    loader: ({ request }) => {
      const params = new URLSearchParams({
        pageNumber:  String(request.page),
        pageSize:    String(request.pageSize),
        newestFirst: 'true',
      });
      if (request.search) params.set('search', request.search);
      return this.http.get<PaginatedUnitResponse>(`${this.apiUrl}?${params}`);
    }
  });

  readonly rawUnits   = computed(() => this._unitsResource.value()?.data ?? []);
  readonly totalPages = computed(() => this._unitsResource.value()?.totalPages ?? 1);
  readonly totalCount = computed(() => this._unitsResource.value()?.totalCount ?? 0);
  readonly isLoading  = this._unitsResource.isLoading;

  readonly buildingsWithUnitsSignal = computed<BuildingWithUnits[]>(() => {
    const tab = this.activeTab();
    const filtered = this.rawUnits().filter(u => this.matchesTab(u.reviewStatus, tab));
    const groups = new Map<number, BuildingWithUnits>();
    for (const u of filtered) {
      if (!groups.has(u.propertyId)) {
        groups.set(u.propertyId, {
          id:            String(u.propertyId),
          name:          u.propertyName,
          location:      '',
          publishedUnits: 0,
          image:         u.mainPhotoUrl ?? 'assets/images/products/review_image.png',
          units:         [],
        });
      }
      const g = groups.get(u.propertyId)!;
      g.units.push(this.mapToUnitCard(u));
      g.publishedUnits = g.units.length;
    }
    return Array.from(groups.values());
  });

  private matchesTab(reviewStatus: string, tab: UnitTab): boolean {
    switch (tab) {
      case 'published':   return reviewStatus === 'Approved';
      case 'new':         return reviewStatus === 'Pending';
      case 'underReview': return reviewStatus === 'UnderReview';
      case 'rejected':    return reviewStatus === 'Rejected';
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

  private mapToUnitCard(u: UnitApiItem): UnitCardItem {
    return {
      id:          String(u.unitId),
      unitNumber:  String(u.apartmentNumberInFloor),
      title:       u.name ?? `${u.unitTypeName} ${u.apartmentNumberInFloor}`,
      floor:       String(u.floorNumber),
      capacity:    '',
      status:      this.reviewStatusToUnitStatus(u.reviewStatus),
      type:        u.unitTypeName,
      description: '',
      rooms:       0,
      hasPool:     false,
    };
  }

  private reviewStatusToUnitStatus(reviewStatus: string): UnitStatus {
    switch (reviewStatus) {
      case 'Approved':    return 'active';
      case 'Rejected':    return 'stopped';
      case 'UnderReview': return 'underReview';
      default:            return 'underReview';
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
  }

  setSearch(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
  }
}
