import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  BanHistoryResponse,
  ListingBanRefund,
  ListingBanResult,
  ListingKind,
  RefundListResponse,
  RefundStatus,
} from '../interfaces/listing-ban.model';

@Injectable({ providedIn: 'root' })
export class ListingBanService {
  private http = inject(HttpClient);
  private readonly refundsUrl = `${environment.apiBaseUrl}/api/listing-ban-refunds`;

  private baseUrl(kind: ListingKind, id: string | number): string {
    const resource = kind === 'property' ? 'properties' : 'units';
    return `${environment.apiBaseUrl}/api/${resource}/${id}`;
  }

  ban(kind: ListingKind, id: string | number, reason: string): Observable<ListingBanResult> {
    return this.http.post<ListingBanResult>(`${this.baseUrl(kind, id)}/ban`, { reason });
  }

  // For a property the new reason also propagates to units with bannedByProperty = true.
  updateReason(kind: ListingKind, id: string | number, reason: string): Observable<ListingBanResult> {
    return this.http.put<ListingBanResult>(`${this.baseUrl(kind, id)}/ban`, { reason });
  }

  // Always returns the listing to UnderReview; cancelled bookings don't come back.
  unban(kind: ListingKind, id: string | number): Observable<ListingBanResult> {
    return this.http.post<ListingBanResult>(`${this.baseUrl(kind, id)}/unban`, {});
  }

  // Newest first. pageSize is capped at 100 by the backend.
  getHistory(kind: ListingKind, id: string | number, pageNumber = 1, pageSize = 20): Observable<BanHistoryResponse> {
    const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) });
    return this.http.get<BanHistoryResponse>(`${this.baseUrl(kind, id)}/ban-history?${params}`);
  }

  // ── Refunds ────────────────────────────────────────────────────────────

  /** Omitting status returns every refund. */
  getRefunds(status: RefundStatus | null, pageNumber = 1, pageSize = 20): Observable<RefundListResponse> {
    const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize) });
    if (status) params.set('status', status);
    return this.http.get<RefundListResponse>(`${this.refundsUrl}?${params}`);
  }

  // ManualReview only. Returns the refund back in Pending with attempts = 0; the actual
  // attempt runs in the background a few seconds later.
  retryRefund(id: number): Observable<ListingBanRefund> {
    return this.http.post<ListingBanRefund>(`${this.refundsUrl}/${id}/retry`, {});
  }

  // ManualReview only — after it was settled outside the system (e.g. the gateway dashboard).
  markRefundResolved(id: number, note: string | null): Observable<ListingBanRefund> {
    return this.http.post<ListingBanRefund>(`${this.refundsUrl}/${id}/mark-resolved`, note ? { note } : {});
  }
}
