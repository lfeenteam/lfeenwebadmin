import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CancellationRefund, CancellationRefundListResponse, CancellationRefundResolveRequest } from './cancellation-refund.model';

@Injectable({ providedIn: 'root' })
export class CancellationRefundsService {
  private http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/api/cancellation-manual-review-refunds`;

  /** CancellationRefunds.View. ManualReview jobs only, oldest first. */
  getList(pageNumber = 1, pageSize = 20): Observable<CancellationRefundListResponse> {
    const params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize);
    return this.http.get<CancellationRefundListResponse>(this.url, { params });
  }

  /**
   * CancellationRefunds.Manage. Only re-queues the job (attempts back to 0); the backend picks it
   * up within ~30s. No body: the backend takes the admin from the token.
   */
  retry(id: number): Observable<CancellationRefund> {
    return this.http.post<CancellationRefund>(`${this.url}/${id}/retry`, null);
  }

  /**
   * CancellationRefunds.Manage. Closes a ManualReview job after the money was refunded outside
   * the system (e.g. a bank transfer). The admin comes from the token.
   */
  markResolved(id: number, body: CancellationRefundResolveRequest): Observable<CancellationRefund> {
    return this.http.post<CancellationRefund>(`${this.url}/${id}/mark-resolved`, body);
  }
}
