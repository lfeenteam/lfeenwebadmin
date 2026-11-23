import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { GetServiceFaqsParams, SaveServiceFaqRequest, ServiceFaqDto } from '../interfaces/service-faq.model';

/** Unwraps `{ data }` only if a future backend adds the envelope; today success is bare. */
function unwrap<T>(res: unknown): T {
  if (res && typeof res === 'object' && !Array.isArray(res) && 'data' in res && 'success' in res) {
    return (res as { data: T }).data;
  }
  return res as T;
}

@Injectable({ providedIn: 'root' })
export class ServiceFaqService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/service/faqs`;

  /** Ordered by displayOrder on the server, no paging. Every param is optional. */
  getAll(params: GetServiceFaqsParams = {}): Observable<ServiceFaqDto[]> {
    let httpParams = new HttpParams();
    if (params.includeInactive) httpParams = httpParams.set('includeInactive', 'true');
    if (params.category) httpParams = httpParams.set('category', params.category);
    if (params.search) httpParams = httpParams.set('search', params.search);

    return this.http
      .get<unknown>(this.baseUrl, { params: httpParams })
      .pipe(map(res => {
        const list = unwrap<ServiceFaqDto[]>(res);
        return Array.isArray(list) ? list : [];
      }));
  }

  create(body: SaveServiceFaqRequest): Observable<ServiceFaqDto> {
    return this.http.post<unknown>(this.baseUrl, body).pipe(map(res => unwrap<ServiceFaqDto>(res)));
  }

  update(id: string, body: SaveServiceFaqRequest): Observable<ServiceFaqDto> {
    return this.http.put<unknown>(`${this.baseUrl}/${id}`, body).pipe(map(res => unwrap<ServiceFaqDto>(res)));
  }

  setActive(id: string, isActive: boolean): Observable<ServiceFaqDto> {
    return this.http
      .patch<unknown>(`${this.baseUrl}/${id}/active`, { isActive })
      .pipe(map(res => unwrap<ServiceFaqDto>(res)));
  }

  delete(id: string): Observable<boolean> {
    return this.http.delete<unknown>(`${this.baseUrl}/${id}`).pipe(map(() => true));
  }
}
