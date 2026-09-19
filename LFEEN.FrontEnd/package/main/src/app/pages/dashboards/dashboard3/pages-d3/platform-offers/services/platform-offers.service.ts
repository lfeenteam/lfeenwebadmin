import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CustomMessage, ExclusionPeriod, OfferFormValue, OfferListParams, OfferTerm, OfferUnit, PlatformOfferDetail, PlatformOfferListResponse, PlatformOfferStatistics } from '../interfaces/platform-offer.model';

@Injectable({ providedIn: 'root' })
export class PlatformOffersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/api/platform-offers`;
  list(filters: OfferListParams): Observable<PlatformOfferListResponse> {
    let params = new HttpParams().set('pageNumber', filters.pageNumber).set('pageSize', filters.pageSize);
    Object.entries(filters).forEach(([key, value]) => { if (!['pageNumber','pageSize'].includes(key) && value !== undefined && value !== null && value !== '') params = params.set(key, String(value)); });
    return this.http.get<PlatformOfferListResponse>(`${this.url}/list`, { params });
  }
  get(id: number): Observable<PlatformOfferDetail> { return this.http.get<PlatformOfferDetail>(`${this.url}/${id}`); }
  stats(id: number): Observable<PlatformOfferStatistics> { return this.http.get<PlatformOfferStatistics>(`${this.url}/${id}/stats`); }
  create(value: OfferFormValue, banner?: File): Observable<number> { return this.http.post<number>(this.url, this.toFormData(value, banner)); }
  update(id: number, value: OfferFormValue, banner?: File): Observable<boolean> { return this.http.put<boolean>(`${this.url}/${id}`, this.toFormData(value, banner)); }
  delete(id: number): Observable<boolean> { return this.http.delete<boolean>(`${this.url}/${id}`); }
  setActive(id: number, active: boolean): Observable<boolean> { return this.http.patch<boolean>(`${this.url}/${id}/${active ? 'activate' : 'deactivate'}`, null); }
  checkCode(code: string): Observable<{isAvailable: boolean; messageAr: string; messageEn: string}> { return this.http.get<any>(`${this.url}/check-code`, { params: { code } }); }
  addUnit(id: number, unitId: number): Observable<OfferUnit> { return this.http.post<OfferUnit>(`${this.url}/${id}/units/${unitId}`, {}); }
  removeUnit(id: number, unitId: number): Observable<boolean> { return this.http.delete<boolean>(`${this.url}/${id}/units/${unitId}`); }
  addExclusion(id: number, body: ExclusionPeriod): Observable<ExclusionPeriod> { return this.http.post<ExclusionPeriod>(`${this.url}/${id}/exclusion-periods`, body); }
  removeExclusion(id: number, itemId: number): Observable<boolean> { return this.http.delete<boolean>(`${this.url}/${id}/exclusion-periods/${itemId}`); }
  saveMessage(id: number, body: CustomMessage): Observable<CustomMessage> { return this.http.post<CustomMessage>(`${this.url}/${id}/messages`, body); }
  removeMessage(id: number, itemId: number): Observable<boolean> { return this.http.delete<boolean>(`${this.url}/${id}/messages/${itemId}`); }
  addTerm(id: number, body: OfferTerm): Observable<OfferTerm> { return this.http.post<OfferTerm>(`${this.url}/${id}/terms`, body); }
  removeTerm(id: number, itemId: number): Observable<boolean> { return this.http.delete<boolean>(`${this.url}/${id}/terms/${itemId}`); }
  private toFormData(value: OfferFormValue, banner?: File): FormData {
    const data = new FormData();
    Object.entries(value).forEach(([key, raw]) => {
      if (raw === null || raw === undefined || raw === '') return;
      if (key === 'unitIds') (raw as number[]).forEach((v, i) => data.append(`unitIds[${i}]`, String(v)));
      else if (key === 'exclusionPeriods' || key === 'customMessages' || key === 'offerTerms') (raw as Record<string, unknown>[]).forEach((row, i) => Object.entries(row).forEach(([child, childValue]) => { if (child !== 'id' && childValue !== null && childValue !== undefined && childValue !== '') data.append(`${key}[${i}].${child}`, String(childValue)); }));
      else data.append(key, String(raw));
    });
    if (banner) data.append('bannerFile', banner, banner.name);
    return data;
  }
}
