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

    return this.http.get<FaqArticleDto[]>(this.baseUrl, { params: httpParams });
  }

  createArticle(payload: CreateFaqArticleRequest): Observable<FaqArticleDto> {
    return this.http.post<FaqArticleDto>(this.baseUrl, payload);
  }

  updateArticle(id: number, payload: UpdateFaqArticleRequest): Observable<FaqArticleDto> {
    return this.http.put<FaqArticleDto>(`${this.baseUrl}/${id}`, payload);
  }

  deleteArticle(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
