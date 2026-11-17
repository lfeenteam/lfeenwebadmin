import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  EsimDetail, EsimListQuery, EsimListResponse, EsimOrder, EsimRefundRequest, EsimStateAction, EsimStateChangeResult, EsimSummary,
} from '../interfaces/esim.model';

/** Admin eSIM API — a thin proxy to EQAMATIK. Auth + Accept-Language come from AuthInterceptor. */
@Injectable({ providedIn: 'root' })
export class EsimService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl}/api/esim`;

  getSummary(): Observable<EsimSummary> {
    return this.http.get<EsimSummary>(`${this.apiUrl}/summary`);
  }

  getList(query: EsimListQuery): Observable<EsimListResponse> {
    let params = new HttpParams()
      .set('page', query.page)
      .set('pageSize', query.pageSize);
    if (query.statusBucket) params = params.set('statusBucket', query.statusBucket);
    if (query.destinationType) params = params.set('destinationType', query.destinationType);
    if (query.destinationCode) params = params.set('destinationCode', query.destinationCode);
    if (query.networkType) params = params.set('networkType', query.networkType);
    if (query.search) params = params.set('search', query.search);
    if (query.needsSupportAttention !== undefined) params = params.set('needsSupportAttention', query.needsSupportAttention);
    return this.http.get<EsimListResponse>(`${this.apiUrl}/esims`, { params });
  }

  getDetail(esimId: string): Observable<EsimDetail> {
    return this.http.get<EsimDetail>(`${this.apiUrl}/esims/${encodeURIComponent(esimId)}`);
  }

  /** Synchronous call to the live provider — slower than the reads. `revoke` is final. */
  changeState(esimId: string, action: EsimStateAction): Observable<EsimStateChangeResult> {
    return this.http.post<EsimStateChangeResult>(`${this.apiUrl}/esims/${encodeURIComponent(esimId)}/state`, { action });
  }

  /**
   * Needs Esim.ManageState. Takes the ORDER id (EsimDetail.orderId), not the esimId.
   * Never retried automatically: after a timeout, check the order before sending again.
   */
  refundOrder(orderId: string, body: EsimRefundRequest): Observable<EsimOrder> {
    return this.http.post<EsimOrder>(`${this.apiUrl}/orders/${encodeURIComponent(orderId)}/refund`, body);
  }
}
