import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  CreateIntegrationFieldRequest,
  CreateSubscriptionDiscountCodeRequest,
  MerchantSubscription,
  ServiceSubscriber,
  SetSubscriptionPriceRequest,
  SubscriptionIntegrationField,
  SubscriptionActivityLogQuery,
  SubscriptionAuditLog,
  SubscriptionCatalogItem,
  SubscriptionDiscountCode,
  SubscriptionOrder,
  SubscriptionOrderStatus,
  SubscriptionOverview,
  SubscriptionPaginated,
  SubscriptionPricingItem,
  SubscriptionTier,
  UpdateSubscriptionServiceRequest,
} from '../pages-d3/subscriptions/interfaces/subscription.model';

export const ORDER_STATUSES: SubscriptionOrderStatus[] = ['Pending', 'UnderReview', 'Approved', 'Rejected'];

// The guide says the subscriber endpoints are paginated but not in which envelope. The
// activity-log shape ({ data, totalCount, page, nextpage, totalPages }) is assumed; a bare
// array is also accepted so the tables still render if the envelope differs.
function toPage<T>(res: unknown): SubscriptionPaginated<T> {
  if (Array.isArray(res)) {
    return { data: res as T[], totalCount: res.length, page: 1, nextpage: null, totalPages: 1 };
  }
  const r = (res ?? {}) as Partial<SubscriptionPaginated<T>> & { items?: T[] };
  const data = r.data ?? r.items ?? [];
  return {
    data,
    totalCount: r.totalCount ?? data.length,
    page: r.page ?? 1,
    nextpage: r.nextpage ?? null,
    totalPages: Math.max(1, r.totalPages ?? 1),
  };
}

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

  // Creates a new pricing row and closes the active one for the same (service, tier, period) —
  // the caller must pass every fee it wants kept, not just the one it changed.
  setPricing(body: SetSubscriptionPriceRequest): Observable<SubscriptionPricingItem> {
    return this.http.post<SubscriptionPricingItem>(`${this.apiUrl}/pricing`, body);
  }

  // ── Integration fields (schema only) ────────────────────────
  getIntegrationFields(subscriptionServiceId: number): Observable<SubscriptionIntegrationField[]> {
    return this.http.get<SubscriptionIntegrationField[]>(`${this.apiUrl}/${subscriptionServiceId}/integration-fields`);
  }

  createIntegrationField(body: CreateIntegrationFieldRequest): Observable<SubscriptionIntegrationField> {
    return this.http.post<SubscriptionIntegrationField>(`${this.apiUrl}/integration-fields`, body);
  }

  deactivateIntegrationField(id: number): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/integration-fields/${id}/deactivate`, {});
  }

  // ── Subscribers ─────────────────────────────────────────────
  /** One row per (merchant, property) line subscribed to a single service. */
  getServiceSubscribers(subscriptionServiceId: number, query: { search?: string; pageNumber?: number; pageSize?: number } = {}): Observable<SubscriptionPaginated<ServiceSubscriber>> {
    let params = this.pageParams(query);
    if (query.search) params = params.set('search', query.search);
    return this.http.get<unknown>(`${this.apiUrl}/${subscriptionServiceId}/subscribers`, { params })
      .pipe(map(res => toPage<ServiceSubscriber>(res)));
  }

  /** One row per merchant (their current state, not order history), paginated by merchant. */
  getMerchantSubscriptions(query: { pageNumber?: number; pageSize?: number } = {}): Observable<SubscriptionPaginated<MerchantSubscription>> {
    return this.http.get<unknown>(`${this.apiUrl}/merchant-subscriptions`, { params: this.pageParams(query) })
      .pipe(map(res => toPage<MerchantSubscription>(res)));
  }

  private pageParams(query: { pageNumber?: number; pageSize?: number }): HttpParams {
    return new HttpParams()
      .set('pageNumber', query.pageNumber ?? 1)
      .set('pageSize', query.pageSize ?? 20);
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
