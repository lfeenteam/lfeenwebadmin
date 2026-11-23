import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  AgreementType,
  AgreementVersion,
  CreateDraftRequest,
  PublishRequest,
  SaveDraftRequest,
} from '../interfaces/agreement.model';

/**
 * /api/admin/agreements: responses are the object itself (no success/data envelope).
 * The acting admin comes from the session, so no adminName is ever sent.
 */
@Injectable({ providedIn: 'root' })
export class AgreementsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/api/admin/agreements`;

  list(type?: AgreementType): Observable<AgreementVersion[]> {
    const params = type ? new HttpParams().set('type', type) : undefined;
    return this.http.get<AgreementVersion[]>(this.url, { params });
  }

  get(id: number): Observable<AgreementVersion> {
    return this.http.get<AgreementVersion>(`${this.url}/${id}`);
  }

  /** Unsigned PDF of what is stored on the server (not what is on screen). */
  previewPdf(id: number, lang: 'ar' | 'en'): Observable<Blob> {
    return this.http.get(`${this.url}/${id}/preview-pdf`, {
      params: new HttpParams().set('lang', lang),
      responseType: 'blob',
    });
  }

  createDraft(body: CreateDraftRequest): Observable<AgreementVersion> {
    return this.http.post<AgreementVersion>(`${this.url}/drafts`, body);
  }

  /** Replaces the whole draft: a clause missing from `clauses` is deleted. */
  saveDraft(id: number, body: SaveDraftRequest): Observable<AgreementVersion> {
    return this.http.put<AgreementVersion>(`${this.url}/${id}`, body);
  }

  deleteDraft(id: number): Observable<boolean> {
    return this.http.delete<boolean>(`${this.url}/${id}`);
  }

  publish(id: number, body: PublishRequest): Observable<AgreementVersion> {
    return this.http.post<AgreementVersion>(`${this.url}/${id}/publish`, body);
  }

  /** null clears the expiry date. */
  setExpiry(id: number, expiresAtUtc: string | null): Observable<AgreementVersion> {
    return this.http.patch<AgreementVersion>(`${this.url}/${id}/expiry`, { expiresAtUtc });
  }

  end(id: number): Observable<AgreementVersion> {
    return this.http.post<AgreementVersion>(`${this.url}/${id}/end`, {});
  }
}
