import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { MonoTypeOperatorFunction, Observable, shareReplay, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  DashboardFilters,
  DashboardGrowth,
  DashboardInsights,
  DashboardSummary,
  DashboardTopCities,
} from '../pages-d3/ceo-page/interfaces/dashboard.model';
import { LoginService } from './login/login.service';
import { DashboardAccessService, DashboardSource } from './dashboard-widgets';

/**
 * Admin API only. Auth + Accept-Language headers are added by AuthInterceptor.
 * The EQAMATIK X-Api-Key must never be used from the browser.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private login = inject(LoginService);
  private access = inject(DashboardAccessService);
  private apiUrl = `${environment.apiBaseUrl}/api/dashboard`;

  /** Shared by every panel so they all describe the same period. Empty = backend picks current Riyadh month. */
  readonly filters = signal<DashboardFilters>({});

  // Summary feeds both the KPI cards and the comparison table; share one request per period.
  // Matches the backend's 2-minute cache window.
  private summaryCache = new Map<string, { at: number; request$: Observable<DashboardSummary> }>();
  private static readonly STALE_MS = 2 * 60 * 1000;

  constructor() {
    // This service is app-wide: without this, the next admin to sign in on the same tab
    // within the cache window would be served the previous admin's summary.
    this.login.loggingOut$.subscribe(() => {
      this.summaryCache.clear();
      this.filters.set({});
    });
  }

  getSummary(filters: DashboardFilters): Observable<DashboardSummary> {
    // Keyed by admin too, so a cached response never outlives a user switch.
    const userId = this.login.currentUser()?.userId ?? null;
    const key = JSON.stringify([userId, filters.from ?? null, filters.to ?? null, filters.timeZone ?? null]);
    const hit = this.summaryCache.get(key);
    if (hit && Date.now() - hit.at < DashboardService.STALE_MS) return hit.request$;

    const request$ = this.http
      .get<DashboardSummary>(`${this.apiUrl}/summary`, { params: this.params(filters) })
      .pipe(
        this.reportForbidden('summary'),
        tap({
          // Hide the widgets whose groups this admin's response leaves out (TAS-2508).
          next: (summary) => this.access.applySummary(summary),
          error: () => this.summaryCache.delete(key),
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    this.summaryCache.set(key, { at: Date.now(), request$ });
    return request$;
  }

  getGrowth(filters: DashboardFilters): Observable<DashboardGrowth> {
    return this.http
      .get<DashboardGrowth>(`${this.apiUrl}/growth`, { params: this.params(filters) })
      .pipe(this.reportForbidden('growth'));
  }

  getTopCities(filters: DashboardFilters, limit = 6): Observable<DashboardTopCities> {
    return this.http
      .get<DashboardTopCities>(`${this.apiUrl}/top-cities`, { params: this.params(filters, limit) })
      .pipe(this.reportForbidden('topCities'));
  }

  getInsights(filters: DashboardFilters): Observable<DashboardInsights> {
    return this.http
      .get<DashboardInsights>(`${this.apiUrl}/insights`, { params: this.params(filters) })
      .pipe(this.reportForbidden('insights'));
  }

  /** A 403 means the server withholds this dataset: hide its widgets instead of showing an error. */
  private reportForbidden<T>(source: DashboardSource): MonoTypeOperatorFunction<T> {
    return tap({
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 403) this.access.markForbidden(source);
      },
    });
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
