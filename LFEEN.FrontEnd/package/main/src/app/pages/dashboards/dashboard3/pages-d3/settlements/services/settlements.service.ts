import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  MerchantDebt,
  PayoutRecalculation,
  RecalculationPreviewItem,
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

  // ── Recalculation & debts (BUG-1482) ───────────────────────

  /** Payouts that must be recalculated before they can be executed. */
  recalculationPreview(): Observable<RecalculationPreviewItem[]> {
    return this.http.get<unknown>(`${this.url}/recalculation-preview`).pipe(map(r => unwrapList<RecalculationPreviewItem>(r)));
  }

  /** Dry run — returns the old ↔ new figures and saves nothing. */
  getRecalculation(id: string): Observable<PayoutRecalculation> {
    return this.http.get<PayoutRecalculation>(`${this.url}/${id}/recalculation`);
  }

  recalculate(id: string): Observable<PayoutRecalculation> {
    return this.http.post<PayoutRecalculation>(`${this.url}/${id}/recalculate`, {});
  }

  debts(): Observable<MerchantDebt[]> {
    return this.http.get<unknown>(`${this.url}/debts`).pipe(map(r => unwrapList<MerchantDebt>(r)));
  }
}

/** The list endpoints may answer with a bare array or a `{ items }` / `{ data }` envelope. */
function unwrapList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const body = res as { items?: unknown; data?: unknown } | null;
  if (Array.isArray(body?.items)) return body!.items as T[];
  if (Array.isArray(body?.data)) return body!.data as T[];
  const nested = body?.data as { items?: unknown } | undefined;
  if (Array.isArray(nested?.items)) return nested!.items as T[];
  return [];
}
