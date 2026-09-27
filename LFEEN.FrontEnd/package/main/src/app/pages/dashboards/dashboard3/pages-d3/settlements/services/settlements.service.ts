import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ExecuteSettlementRequest,
  SettlementActionResult,
  SettlementDetail,
  SettlementList,
  SettlementListResult,
} from '../interfaces/settlement.model';

const FETCH_PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class SettlementsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/api/settlements`;

  list(status: string, pageNumber = 1, pageSize = FETCH_PAGE_SIZE): Observable<SettlementList> {
    const params = new HttpParams()
      .set('status', status)
      .set('pageNumber', pageNumber)
      .set('pageSize', pageSize);
    return this.http.get<SettlementList>(this.url, { params });
  }

  /**
   * The list endpoint filters by a single status only, while a tab spans several
   * statuses. Each status is fetched in full (every page) and the caller merges,
   * sorts and pages locally — that keeps ordering and paging correct.
   */
  listAllByStatuses(statuses: readonly string[]): Observable<SettlementListResult> {
    return forkJoin(statuses.map(s => this.listAllByStatus(s))).pipe(
      map(groups => ({
        items: groups.flatMap(g => g.items),
        summary: groups.find(g => g.summary)?.summary ?? null,
      })),
    );
  }

  private listAllByStatus(status: string): Observable<SettlementListResult> {
    return this.list(status, 1).pipe(
      switchMap(first => {
        const summary = first.summary ?? null;
        if (first.totalPages <= 1) return of({ items: first.items, summary });
        const rest = Array.from({ length: first.totalPages - 1 }, (_, i) => this.list(status, i + 2));
        return forkJoin(rest).pipe(map(pages => ({ items: [first, ...pages].flatMap(p => p.items), summary })));
      }),
    );
  }

  get(id: string): Observable<SettlementDetail> {
    return this.http.get<SettlementDetail>(`${this.url}/${id}`);
  }

  execute(id: string, body: ExecuteSettlementRequest): Observable<SettlementActionResult> {
    return this.http.post<SettlementActionResult>(`${this.url}/${id}/execute`, body);
  }

  fail(id: string, reason: string): Observable<SettlementActionResult> {
    return this.http.post<SettlementActionResult>(`${this.url}/${id}/fail`, { reason });
  }

  uploadReceipt(id: string, file: File): Observable<SettlementActionResult> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<SettlementActionResult>(`${this.url}/${id}/receipt`, form);
  }
}
