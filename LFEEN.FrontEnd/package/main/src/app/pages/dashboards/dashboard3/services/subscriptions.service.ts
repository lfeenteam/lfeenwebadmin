import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { SubscriptionCatalogItem, SubscriptionOrder, SubscriptionOrderStatus, SubscriptionPricingItem, SubscriptionPricingPeriod } from '../pages-d3/subscriptions/interfaces/subscription.model';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionsService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiBaseUrl}/api/subscriptions`;

  getCatalog(): Observable<SubscriptionCatalogItem[]> {
    return this.http.get<SubscriptionCatalogItem[]>(`${this.apiUrl}/catalog`);
  }

  getPricing(): Observable<SubscriptionPricingItem[]> {
    return this.http.get<SubscriptionPricingItem[]>(`${this.apiUrl}/pricing`);
  }

  setPrice(subscriptionServiceId: number, period: SubscriptionPricingPeriod, price: number): Observable<SubscriptionPricingItem> {
    return this.http.post<SubscriptionPricingItem>(`${this.apiUrl}/pricing`, { subscriptionServiceId, period, price });
  }

  getRequestsByStatus(status: SubscriptionOrderStatus): Observable<SubscriptionOrder[]> {
    return this.http.get<SubscriptionOrder[]>(`${this.apiUrl}/requests?status=${status}`);
  }

  // The endpoint only returns one status at a time and there's no "all" option,
  // so a full log needs every status merged client-side.
  getAllRequests(): Observable<SubscriptionOrder[]> {
    const statuses: SubscriptionOrderStatus[] = ['Pending', 'UnderReview', 'Approved', 'Rejected'];
    return forkJoin(statuses.map(status => this.getRequestsByStatus(status))).pipe(
      map(results => results.flat())
    );
  }
}
