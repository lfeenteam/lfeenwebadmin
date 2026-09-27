import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  CreateSubscriptionDiscountCodeRequest,
  SetSubscriptionPriceRequest,
  SubscriptionActivityLogQuery,
  SubscriptionAuditLog,
  SubscriptionCatalogItem,
  SubscriptionDiscountCode,
  SubscriptionOrder,
  SubscriptionOrderStatus,
  SubscriptionOverview,
  SubscriptionPaginated,
  SubscriptionPricingItem,
  SubscriptionPricingPeriod,
  SubscriptionTier,
  UpdateSubscriptionServiceRequest,
} from '../pages-d3/subscriptions/interfaces/subscription.model';

export const ORDER_STATUSES: SubscriptionOrderStatus[] = ['Pending', 'UnderReview', 'Approved', 'Rejected'];

@Injectable({
  providedIn: 'root'
})
export class SubscriptionsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl}/api/subscriptions`;

  // ── Catalog ─────────────────────────────────────────────────
  getCatalog(): Observable<SubscriptionCatalogItem[]> {
    return this.http.get<SubscriptionCatalogItem[]>(`${this.apiUrl}/catalog`);
  }

  updateCatalogItem(id: number, body: UpdateSubscriptionServiceRequest): Observable<SubscriptionCatalogItem> {
    return this.http.put<SubscriptionCatalogItem>(`${this.apiUrl}/catalog/${id}`, body);
  }

  // ── Pricing ─────────────────────────────────────────────────
  getPricing(): Observable<SubscriptionPricingItem[]> {
    return this.http.get<SubscriptionPricingItem[]>(`${this.apiUrl}/pricing`);
  }

  setPrice(subscriptionServiceId: number, period: SubscriptionPricingPeriod, price: number, currencyCode = 'SAR'): Observable<SubscriptionPricingItem> {
    const body: SetSubscriptionPriceRequest = { subscriptionServiceId, period, price, currencyCode };
    return this.http.post<SubscriptionPricingItem>(`${this.apiUrl}/pricing`, body);
  }

  // ── Tiers ───────────────────────────────────────────────────
  getTiers(subscriptionServiceId?: number): Observable<SubscriptionTier[]> {
    let params = new HttpParams();
    if (subscriptionServiceId != null) params = params.set('subscriptionServiceId', subscriptionServiceId);
    return this.http.get<SubscriptionTier[]>(`${this.apiUrl}/tiers`, { params });
  }

  // ── Discount codes ──────────────────────────────────────────
  getDiscountCodes(): Observable<SubscriptionDiscountCode[]> {
    return this.http.get<SubscriptionDiscountCode[]>(`${this.apiUrl}/discount-codes`);
  }

  createDiscountCode(body: CreateSubscriptionDiscountCodeRequest): Observable<SubscriptionDiscountCode> {
    return this.http.post<SubscriptionDiscountCode>(`${this.apiUrl}/discount-codes`, body);
  }

  setDiscountCodeActive(id: number, active: boolean): Observable<SubscriptionDiscountCode> {
    return this.http.post<SubscriptionDiscountCode>(`${this.apiUrl}/discount-codes/${id}/${active ? 'activate' : 'deactivate'}`, {});
  }

  // ── Orders / requests ───────────────────────────────────────
  getOverview(): Observable<SubscriptionOverview> {
    return this.http.get<SubscriptionOverview>(`${this.apiUrl}/overview`);
  }

  getRequestsByStatus(status: SubscriptionOrderStatus): Observable<SubscriptionOrder[]> {
    return this.http.get<SubscriptionOrder[]>(`${this.apiUrl}/requests`, { params: { status } }).pipe(
      // Raw status may come back as a numeric string — the filter it was fetched
      // under is the reliable value, so it replaces anything we don't recognize.
      map(orders => orders.map(o => (ORDER_STATUSES as string[]).includes(o.status ?? '') ? o : { ...o, status }))
    );
  }

  approveOrder(orderId: string, note?: string): Observable<SubscriptionOrder> {
    return this.http.post<SubscriptionOrder>(`${this.apiUrl}/orders/${orderId}/approve`, note ? { note } : {});
  }

  rejectOrder(orderId: string, reason: string): Observable<SubscriptionOrder> {
    return this.http.post<SubscriptionOrder>(`${this.apiUrl}/orders/${orderId}/reject`, { reason });
  }

  // ── Activity log ────────────────────────────────────────────
  getActivityLog(query: SubscriptionActivityLogQuery = {}): Observable<SubscriptionPaginated<SubscriptionAuditLog>> {
    let params = new HttpParams()
      .set('pageNumber', query.pageNumber ?? 1)
      .set('pageSize', query.pageSize ?? 20);
    if (query.accountId) params = params.set('accountId', query.accountId);
    if (query.subscriptionServiceId != null) params = params.set('subscriptionServiceId', query.subscriptionServiceId);
    return this.http.get<SubscriptionPaginated<SubscriptionAuditLog>>(`${this.apiUrl}/activity-log`, { params });
  }
}
