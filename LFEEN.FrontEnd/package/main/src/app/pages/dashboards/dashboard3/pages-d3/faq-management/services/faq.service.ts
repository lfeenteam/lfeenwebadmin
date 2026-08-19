import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CreateFaqArticleRequest, FaqArticleDto, GetFaqArticlesParams, UpdateFaqArticleRequest } from '../interfaces/faq.model';

@Injectable({ providedIn: 'root' })
export class FaqService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/api/support-faq`;

  getArticles(params?: GetFaqArticlesParams): Observable<FaqArticleDto[]> {
    let httpParams = new HttpParams();
    if (params?.department) httpParams = httpParams.set('department', params.department);
    if (params?.activeOnly !== undefined) httpParams = httpParams.set('activeOnly', String(params.activeOnly));
    httpParams = httpParams.set('pageNumber', String(params?.pageNumber ?? 1));
    httpParams = httpParams.set('pageSize', String(params?.pageSize ?? 100));

    return this.http.get<FaqArticleDto[]>(this.baseUrl, { params: httpParams });
  }

  getArticleById(externalId: string): Observable<FaqArticleDto> {
    return this.http.get<FaqArticleDto>(`${this.baseUrl}/${externalId}`);
  }

  createArticle(payload: CreateFaqArticleRequest): Observable<FaqArticleDto> {
    return this.http.post<FaqArticleDto>(this.baseUrl, payload);
  }

  updateArticle(externalId: string, payload: UpdateFaqArticleRequest): Observable<FaqArticleDto> {
    return this.http.put<FaqArticleDto>(`${this.baseUrl}/${externalId}`, payload);
  }

  activateArticle(externalId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${externalId}`, {});
  }

  deactivateArticle(externalId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${externalId}/deactivate`, {});
  }

  deleteArticle(externalId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${externalId}`);
  }
}
