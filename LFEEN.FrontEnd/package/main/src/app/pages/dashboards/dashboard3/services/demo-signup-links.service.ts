import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  CreateDemoSignupLinksRequest,
  DemoSignupBatch,
  DemoSignupCancelResult,
  DemoSignupLink,
  DemoSignupLinksQuery,
  DemoSignupPage
} from '../interfaces/demo-signup-link.model';

/**
 * The Admin API passes eqamatik's body as is — some answers may come inside { data }.
 * None of these DTOs has a field named "data", so it is safe to unwrap.
 */
function unwrap<T>(res: any): T {
  return res && typeof res === 'object' && res.data != null && typeof res.data === 'object' ? res.data as T : res as T;
}

// Demo links (MUL-0004). Like DemoAccountsService, the Admin API takes the admin from the
// token, so adminId/adminName are never sent. Writes are never retried automatically.
@Injectable({ providedIn: 'root' })
export class DemoSignupLinksService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/admin/demo-signup-links`;

  /** 201 with the batch and all its new links. No account exists until a link is opened. */
  create(body: CreateDemoSignupLinksRequest): Observable<DemoSignupBatch> {
    return this.http.post(this.baseUrl, body).pipe(map(r => unwrap<DemoSignupBatch>(r)));
  }

  list(query: DemoSignupLinksQuery): Observable<DemoSignupPage<DemoSignupLink>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return this.http.get(this.baseUrl, { params }).pipe(map(r => unwrap<DemoSignupPage<DemoSignupLink>>(r)));
  }

  /** Batches with their counters (no links). */
  batches(pageNumber = 1, pageSize = 100): Observable<DemoSignupPage<DemoSignupBatch>> {
    const params = new HttpParams().set('pageNumber', String(pageNumber)).set('pageSize', String(pageSize));
    return this.http.get(`${this.baseUrl}/batches`, { params }).pipe(map(r => unwrap<DemoSignupPage<DemoSignupBatch>>(r)));
  }

  /** The whole batch with every link; 404 DEMO_SIGNUP_BATCH_NOT_FOUND. */
  batch(batchId: string): Observable<DemoSignupBatch> {
    return this.http.get(`${this.baseUrl}/batches/${batchId}`).pipe(map(r => unwrap<DemoSignupBatch>(r)));
  }

  /** Opened links are cancelled too — their demo account is stopped for good (accountsStopped). */
  cancel(linkIds: string[]): Observable<DemoSignupCancelResult> {
    return this.http.post(`${this.baseUrl}/cancel`, { linkIds }).pipe(map(r => unwrap<DemoSignupCancelResult>(r)));
  }

  /** Every link of the batch, opened or not; already cancelled / expired ones are skipped. */
  cancelBatch(batchId: string): Observable<DemoSignupCancelResult> {
    return this.http.post(`${this.baseUrl}/batches/${batchId}/cancel`, {}).pipe(map(r => unwrap<DemoSignupCancelResult>(r)));
  }
}
