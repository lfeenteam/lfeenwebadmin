import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  CreateIntegrationFieldRequest,
  CreatePeriodOptionRequest,
  CreateSubscriptionDiscountCodeRequest,
  CreateSubscriptionFeatureRequest,
  CreateSubscriptionServiceRequest,
  CreateSubscriptionTierRequest,
  SubscriptionServiceFeature,
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
  SubscriptionPeriodOption,
  SubscriptionPricingItem,
  SubscriptionTier,
  UpdatePeriodOptionRequest,
  UpdateSubscriptionServiceRequest,
} from '../pages-d3/subscriptions/interfaces/subscription.model';

export const ORDER_STATUSES: SubscriptionOrderStatus[] = ['Pending', 'Succeeded', 'Failed'];

// Paginated endpoints answer { data, totalCount, page, nextpage, totalPages }; a bare array
// is also accepted so the tables still render if the envelope differs.
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
  getCatalog(query: { search?: string; category?: string } = {}): Observable<SubscriptionCatalogItem[]> {
    let params = new HttpParams();
    if (query.search) params = params.set('search', query.search);
    if (query.category) params = params.set('category', query.category);
    return this.http.get<SubscriptionCatalogItem[]>(`${this.apiUrl}/catalog`, { params });
  }

  createCatalogItem(body: CreateSubscriptionServiceRequest): Observable<SubscriptionCatalogItem> {
    return this.http.post<SubscriptionCatalogItem>(`${this.apiUrl}/catalog`, body);
  }

  updateCatalogItem(id: number, body: UpdateSubscriptionServiceRequest): Observable<SubscriptionCatalogItem> {
    return this.http.put<SubscriptionCatalogItem>(`${this.apiUrl}/catalog/${id}`, body);
  }

  // ── Pricing: Transaction rate (period None) and MessagePack ──
  /** Every row ever created, active or not. */
  getPricing(): Observable<SubscriptionPricingItem[]> {
    return this.http.get<SubscriptionPricingItem[]>(`${this.apiUrl}/pricing`);
  }

  /** Closes the active row for the same (service, tier, period) and opens a new one. */
  setPricing(body: SetSubscriptionPriceRequest): Observable<SubscriptionPricingItem> {
    return this.http.post<SubscriptionPricingItem>(`${this.apiUrl}/pricing`, body);
  }

  // ── Period options (Package-style price list) ───────────────
  /** Every option ever created, including superseded ones. */
  getPeriodOptions(subscriptionServiceId?: number): Observable<SubscriptionPeriodOption[]> {
    let params = new HttpParams();
    if (subscriptionServiceId != null) params = params.set('subscriptionServiceId', subscriptionServiceId);
    return this.http.get<SubscriptionPeriodOption[]>(`${this.apiUrl}/period-options`, { params });
  }

  createPeriodOption(body: CreatePeriodOptionRequest): Observable<SubscriptionPeriodOption> {
    return this.http.post<SubscriptionPeriodOption>(`${this.apiUrl}/period-options`, body);
  }

  /** Supersedes: closes {id} and returns the new active row (a different id). */
  updatePeriodOption(id: number, body: UpdatePeriodOptionRequest): Observable<SubscriptionPeriodOption> {
    return this.http.put<SubscriptionPeriodOption>(`${this.apiUrl}/period-options/${id}`, body);
  }

  deactivatePeriodOption(id: number): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/period-options/${id}/deactivate`, {});
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

  createTier(body: CreateSubscriptionTierRequest): Observable<SubscriptionTier> {
    return this.http.post<SubscriptionTier>(`${this.apiUrl}/tiers`, body);
  }

  // ── Catalog card features (no update endpoint: deactivate + recreate) ──
  getFeatures(subscriptionServiceId?: number): Observable<SubscriptionServiceFeature[]> {
    let params = new HttpParams();
    if (subscriptionServiceId != null) params = params.set('subscriptionServiceId', subscriptionServiceId);
    return this.http.get<SubscriptionServiceFeature[]>(`${this.apiUrl}/features`, { params });
  }

  createFeature(body: CreateSubscriptionFeatureRequest): Observable<SubscriptionServiceFeature> {
    return this.http.post<SubscriptionServiceFeature>(`${this.apiUrl}/features`, body);
  }

  deactivateFeature(id: number): Observable<unknown> {
    return this.http.post(`${this.apiUrl}/features/${id}/deactivate`, {});
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

  // ── Overview / order history ────────────────────────────────
  getOverview(): Observable<SubscriptionOverview> {
    return this.http.get<SubscriptionOverview>(`${this.apiUrl}/overview`);
  }

  /** Read-only history — no status = every order. */
  getRequests(status?: SubscriptionOrderStatus): Observable<SubscriptionOrder[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<SubscriptionOrder[]>(`${this.apiUrl}/requests`, { params });
  }

  // ── Activity log ────────────────────────────────────────────
  getActivityLog(query: SubscriptionActivityLogQuery = {}): Observable<SubscriptionPaginated<SubscriptionAuditLog>> {
    let params = new HttpParams()
      .set('pageNumber', query.pageNumber ?? 1)
      .set('pageSize', query.pageSize ?? 20);
    if (query.accountId) params = params.set('accountId', query.accountId);
    if (query.subscriptionServiceId != null) params = params.set('subscriptionServiceId', query.subscriptionServiceId);
    return this.http.get<unknown>(`${this.apiUrl}/activity-log`, { params })
      .pipe(map(res => toPage<SubscriptionAuditLog>(res)));
  }
}
