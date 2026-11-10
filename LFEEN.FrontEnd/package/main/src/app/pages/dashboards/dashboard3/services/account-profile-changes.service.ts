import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  AccountProfile,
  AccountProfileChangesPage,
  AccountProfileChangesQuery,
  AccountProfileReviewResult,
  CertificateVersion,
  ProfileSectionRoute,
  ReviewAccountProfileChangeRequest
} from '../interfaces/account-profile-change.model';

// Branding / commercial-register changes hosts submit after approval. Plain JSON
// responses (no success/data envelope). View needs Accounts.View, decisions Accounts.Review.
@Injectable({ providedIn: 'root' })
export class AccountProfileChangesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/accounts`;

  // GET /api/accounts/profile-changes — pending drafts only, oldest first.
  list(query: AccountProfileChangesQuery): Observable<AccountProfileChangesPage> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<AccountProfileChangesPage>(`${this.baseUrl}/profile-changes`, { params });
  }

  // GET /api/accounts/{accountId}/profile-changes — current vs requested per section.
  getProfile(accountId: string): Observable<AccountProfile> {
    return this.http.get<AccountProfile>(`${this.baseUrl}/${accountId}/profile-changes`);
  }

  // POST /api/accounts/{accountId}/profile-changes/{section}/review — 409 when changeId is stale.
  review(
    accountId: string,
    section: ProfileSectionRoute,
    body: ReviewAccountProfileChangeRequest
  ): Observable<AccountProfileReviewResult> {
    return this.http.post<AccountProfileReviewResult>(
      `${this.baseUrl}/${accountId}/profile-changes/${section}/review`,
      body
    );
  }

  // The certificate is private (no URL) — fetched as a blob so the interceptor adds the JWT.
  downloadCertificate(accountId: string, version: CertificateVersion): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${accountId}/profile-changes/commercial-register/certificate`, {
      params: new HttpParams().set('version', version),
      responseType: 'blob'
    });
  }
}
