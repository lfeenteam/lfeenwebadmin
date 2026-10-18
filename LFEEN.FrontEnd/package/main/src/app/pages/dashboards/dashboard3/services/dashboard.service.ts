import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  DashboardFilters,
  DashboardGrowth,
  DashboardInsights,
  DashboardSummary,
  DashboardTopCities,
} from '../pages-d3/ceo-page/interfaces/dashboard.model';

/**
 * Admin API only. Auth + Accept-Language headers are added by AuthInterceptor.
 * The EQAMATIK X-Api-Key must never be used from the browser.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl}/api/dashboard`;

  /** Shared by every panel so they all describe the same period. Empty = backend picks current Riyadh month. */
  readonly filters = signal<DashboardFilters>({});

  // Summary feeds both the KPI cards and the comparison table; share one request per period.
  // Matches the backend's 2-minute cache window.
  private summaryCache = new Map<string, { at: number; request$: Observable<DashboardSummary> }>();
  private static readonly STALE_MS = 2 * 60 * 1000;

  getSummary(filters: DashboardFilters): Observable<DashboardSummary> {
    const key = JSON.stringify([filters.from ?? null, filters.to ?? null, filters.timeZone ?? null]);
    const hit = this.summaryCache.get(key);
    if (hit && Date.now() - hit.at < DashboardService.STALE_MS) return hit.request$;

    const request$ = this.http
      .get<DashboardSummary>(`${this.apiUrl}/summary`, { params: this.params(filters) })
      .pipe(
        tap({ error: () => this.summaryCache.delete(key) }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    this.summaryCache.set(key, { at: Date.now(), request$ });
    return request$;
  }

  getGrowth(filters: DashboardFilters): Observable<DashboardGrowth> {
    return this.http.get<DashboardGrowth>(`${this.apiUrl}/growth`, { params: this.params(filters) });
  }

  getTopCities(filters: DashboardFilters, limit = 6): Observable<DashboardTopCities> {
    return this.http.get<DashboardTopCities>(`${this.apiUrl}/top-cities`, { params: this.params(filters, limit) });
  }

  getInsights(filters: DashboardFilters): Observable<DashboardInsights> {
    return this.http.get<DashboardInsights>(`${this.apiUrl}/insights`, { params: this.params(filters) });
  }

  // HttpParams encodes the +03:00 offset and the / in Asia/Riyadh.
  private params(filters: DashboardFilters, limit?: number): HttpParams {
    let params = new HttpParams();
    if (filters.from && filters.to) {
      params = params.set('from', filters.from).set('to', filters.to);
    }
    if (filters.timeZone) params = params.set('timeZone', filters.timeZone);
    if (limit != null) params = params.set('limit', String(limit));
    return params;
  }
}
