import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ActivationRequest,
  ActivationRequestsPage,
  ActivationRequestsQuery,
  UpdateActivationRequestStatus,
  CreateDemoAccountRequest,
  DemoAccount,
  DemoAccountCredentials,
  DemoAccountsPage,
  DemoAccountsQuery,
  DemoAttachment,
  InvitationPreview,
  InvitationPreviewRequest,
  InvitationTemplates,
  InvitationTestSendRequest,
  InvitationTestSendResult,
  ResendDemoRequest,
  ResetDemoPinRequest
} from '../interfaces/demo-account.model';

// Trial host accounts. The Admin API takes the admin from the token, so no
// adminId/adminName is sent. Writes are never retried automatically (§6.4).
@Injectable({ providedIn: 'root' })
export class DemoAccountsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/admin/demo-accounts`;

  // GET /api/admin/demo-accounts — newest first, the sort can't be changed.
  list(query: DemoAccountsQuery): Observable<DemoAccountsPage> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<DemoAccountsPage>(this.baseUrl, { params });
  }

  get(id: string): Observable<DemoAccount> {
    return this.http.get<DemoAccount>(`${this.baseUrl}/${id}`);
  }

  // The key is generated when the create form opens; it is reused only when retrying
  // after an answer never reached the browser (see CreateDemoDialogComponent).
  create(body: CreateDemoAccountRequest, idempotencyKey: string): Observable<DemoAccountCredentials> {
    return this.http.post<DemoAccountCredentials>(this.baseUrl, body, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey })
    });
  }

  // 200 even when delivery failed — the real result is deliveries[0].succeeded.
  // Always issues a new PIN; the response never contains it.
  resend(id: string, body: ResendDemoRequest): Observable<DemoAccount> {
    return this.http.post<DemoAccount>(`${this.baseUrl}/${id}/resend`, body);
  }

  // The response carries no deliveries/attachments; the details page re-fetches after it.
  resetPin(id: string, body: ResetDemoPinRequest): Observable<DemoAccountCredentials> {
    return this.http.post<DemoAccountCredentials>(`${this.baseUrl}/${id}/reset-pin`, body);
  }

  extend(id: string, days: number): Observable<DemoAccount> {
    return this.http.post<DemoAccount>(`${this.baseUrl}/${id}/extend`, { days });
  }

  unlock(id: string): Observable<DemoAccount> {
    return this.http.post<DemoAccount>(`${this.baseUrl}/${id}/unlock`, {});
  }

  disable(id: string): Observable<DemoAccount> {
    return this.http.post<DemoAccount>(`${this.baseUrl}/${id}/disable`, {});
  }

  // ── Email invitation attachments (§5) ─────────────────────

  // One request with every newly chosen file. Plain array response (no data wrapper).
  // TODO(backend): confirm the multipart field name ("files", per the Files[0] validation names).
  uploadAttachments(files: File[]): Observable<DemoAttachment[]> {
    const form = new FormData();
    files.forEach(f => form.append('files', f, f.name));
    return this.http.post<DemoAttachment[]>(`${this.baseUrl}/attachments`, form);
  }

  // ── Activation requests ───────────────────────────────────

  // Newest activity first (the order can't be changed). status is optional.
  listActivationRequests(query: ActivationRequestsQuery): Observable<ActivationRequestsPage> {
    let params = new HttpParams()
      .set('pageNumber', String(query.pageNumber))
      .set('pageSize', String(query.pageSize));
    if (query.status) params = params.set('status', query.status);
    return this.http.get<ActivationRequestsPage>(`${this.baseUrl}/activation-requests`, { params });
  }

  // Returns the request after the change. adminId/adminName are never sent (taken from the token).
  updateActivationRequestStatus(requestId: string, body: UpdateActivationRequestStatus): Observable<ActivationRequest> {
    return this.http.post<ActivationRequest>(`${this.baseUrl}/activation-requests/${requestId}/status`, body);
  }

  // ── Invitation editor ─────────────────────────────────────

  // Variables, presets, limits and default subjects. Asked once when the editor opens.
  getInvitationTemplates(): Observable<InvitationTemplates> {
    return this.http.get<InvitationTemplates>(`${this.baseUrl}/invitation-templates`);
  }

  // Renders the invitation for every channel. Saves and sends nothing.
  previewInvitation(body: InvitationPreviewRequest): Observable<InvitationPreview> {
    return this.http.post<InvitationPreview>(`${this.baseUrl}/invitation-preview`, body);
  }

  // Always goes to the signed-in admin's own email; the PIN is masked. 429 when the hourly limit is used.
  sendTestInvitation(body: InvitationTestSendRequest): Observable<InvitationTestSendResult> {
    return this.http.post<InvitationTestSendResult>(`${this.baseUrl}/invitation-test-send`, body);
  }

  // Through HttpClient so the access token is sent (a plain <a href> would not send it).
  downloadAttachment(id: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${id}/attachments/${attachmentId}`, { responseType: 'blob' });
  }
}
