import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ControlCenterApp, ControlCenterPlatform, ControlCenterSummary, ReleaseConfig, SaveMaintenanceRequest,
  SaveReleaseRequest, SaveThemeRequest, SeasonalTheme, VersionImpact,
} from '../interfaces/control-center.model';

/**
 * LFEENAdmin.API app-runtime endpoints. The backend talks to the main API, does partial
 * updates, Saudi-day ↔ UTC conversion and audit logging. Auth + Accept-Language come
 * from AuthInterceptor. Every success is 200 with the payload itself (no envelope).
 */
@Injectable({ providedIn: 'root' })
export class ControlCenterService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl}/api/app-runtime`;

  getSummary(): Observable<ControlCenterSummary> {
    return this.http.get<ControlCenterSummary>(`${this.apiUrl}/summary`);
  }

  // ── Themes ──────────────────────────────────────────────────

  /** Without `app` the list covers every app; inactive ones included, expired ones not. */
  getThemes(): Observable<SeasonalTheme[]> {
    const params = new HttpParams().set('includeInactive', true).set('includeExpired', false);
    return this.http.get<SeasonalTheme[]>(`${this.apiUrl}/themes`, { params });
  }

  getTheme(id: string): Observable<SeasonalTheme> {
    return this.http.get<SeasonalTheme>(`${this.apiUrl}/themes/${encodeURIComponent(id)}`);
  }

  createTheme(body: SaveThemeRequest): Observable<SeasonalTheme> {
    return this.http.post<SeasonalTheme>(`${this.apiUrl}/themes`, body);
  }

  updateTheme(id: string, body: SaveThemeRequest): Observable<SeasonalTheme> {
    return this.http.put<SeasonalTheme>(`${this.apiUrl}/themes/${encodeURIComponent(id)}`, body);
  }

  setThemeActive(id: string, isActive: boolean): Observable<SeasonalTheme> {
    return this.http.patch<SeasonalTheme>(`${this.apiUrl}/themes/${encodeURIComponent(id)}/active`, { isActive });
  }

  /** Soft delete — the key becomes free again. */
  deleteTheme(id: string): Observable<boolean> {
    return this.http.delete<boolean>(`${this.apiUrl}/themes/${encodeURIComponent(id)}`);
  }

  approveTheme(id: string): Observable<SeasonalTheme> {
    return this.http.post<SeasonalTheme>(`${this.apiUrl}/themes/${encodeURIComponent(id)}/approve`, null);
  }

  /** days ∈ [-30, 30] and ≠ 0; negative moves the theme earlier. */
  shiftTheme(id: string, days: number): Observable<SeasonalTheme> {
    return this.http.post<SeasonalTheme>(`${this.apiUrl}/themes/${encodeURIComponent(id)}/shift`, { days });
  }

  // ── Releases & maintenance ──────────────────────────────────

  /** One entry per platform (Web included — callers ignore it). Feeds both tabs. */
  getReleases(app: ControlCenterApp): Observable<ReleaseConfig[]> {
    return this.http.get<ReleaseConfig[]>(`${this.apiUrl}/releases`, { params: { app } });
  }

  getVersionImpact(app: ControlCenterApp, platform: ControlCenterPlatform, minVersion: string): Observable<VersionImpact> {
    return this.http.get<VersionImpact>(`${this.apiUrl}/releases/${app}/${platform}/impact`, { params: { minVersion } });
  }

  saveRelease(app: ControlCenterApp, platform: ControlCenterPlatform, body: SaveReleaseRequest): Observable<ReleaseConfig> {
    return this.http.put<ReleaseConfig>(`${this.apiUrl}/releases/${app}/${platform}`, body);
  }

  /** Returns one entry per platform it changed. */
  saveMaintenance(app: ControlCenterApp, body: SaveMaintenanceRequest): Observable<ReleaseConfig[]> {
    return this.http.put<ReleaseConfig[]>(`${this.apiUrl}/maintenance/${app}`, body);
  }
}
