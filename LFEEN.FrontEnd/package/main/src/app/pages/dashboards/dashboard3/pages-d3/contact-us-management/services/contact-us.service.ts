import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ContactUsDetail, ContactUsListParams, ContactUsListResponse } from '../interfaces/contact-us.model';

@Injectable({ providedIn: 'root' })
export class ContactUsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/contact-us`;

  getRequests(filters: ContactUsListParams): Observable<ContactUsListResponse> {
    let params = new HttpParams().set('page', filters.page).set('pageSize', filters.pageSize);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.search) params = params.set('search', filters.search);
    return this.http.get<ContactUsListResponse>(this.baseUrl, { params });
  }

  getRequest(externalId: string): Observable<ContactUsDetail> {
    return this.http.get<ContactUsDetail>(`${this.baseUrl}/${encodeURIComponent(externalId)}`);
  }

  closeRequest(externalId: string, note?: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/${encodeURIComponent(externalId)}/close`, note ? { note } : {});
  }
}
