import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, defer, merge } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, map, switchMap, tap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { TranslateService } from '@ngx-translate/core';
import { CoreService } from 'src/app/services/core.service';
import { environment } from 'src/environments/environment';
import {
  AdminAuditStatus,
  AdminOperationAuditDetail,
  AdminOperationAuditFilters,
  AdminOperationAuditList,
  AdminOperationAuditStats,
  AuditDatePreset
} from '../interfaces/operation-audit.model';

const DEFAULT_PAGE_SIZE = 10;

/**
 * Provided at the component level (not root) on purpose: audit data is privileged
 * and must not survive across signed-in administrators, so it is dropped together
 * with the page that owns it.
 */
@Injectable()
export class OperationAuditsService {
  private readonly http = inject(HttpClient);
  private readonly coreService = inject(CoreService);
  private readonly toastr = inject(ToastrService);
  private readonly translate = inject(TranslateService);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/operation-audits`;

  readonly filters = signal<AdminOperationAuditFilters>({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  readonly list = signal<AdminOperationAuditList | null>(null);
  readonly isLoading = signal(false);
  readonly loadFailed = signal(false);
  readonly accessDenied = signal(false);

  // Read from the single list response — no extra requests. Until the API returns
  // `stats`, only the total is known (from totalCount, and only when not filtered by status).
  readonly stats = computed<Partial<AdminOperationAuditStats> | null>(() => {
    const list = this.list();
    if (!list) return null;
    if (list.stats) return list.stats;
    return this.filters().status ? {} : { total: list.totalCount };
  });

  readonly items = computed(() => this.list()?.items ?? []);
  readonly totalCount = computed(() => this.list()?.totalCount ?? 0);
  readonly totalPages = computed(() => Math.max(this.list()?.totalPages ?? 1, 1));
  readonly currentPage = computed(() => this.filters().page);
  readonly hasLoadedOnce = computed(() => this.list() !== null);

  private readonly lang = computed(() => this.coreService.getOptionsSignal()().language);
  // Nothing is requested until the audit tab is actually opened.
  private readonly active = signal(false);
  private readonly search$ = new Subject<string>();
  private readonly reload$ = new Subject<void>();

  constructor() {
    const query = computed(() => ({ active: this.active(), filters: this.filters(), lang: this.lang() }));

    merge(toObservable(query), this.reload$.pipe(map(() => query())))
      .pipe(
        filter(({ active }) => active),
        // Keep the current rows on screen while the next page/filter loads.
        switchMap(({ filters }) =>
          defer(() => {
            this.isLoading.set(true);
            this.loadFailed.set(false);
            return this.http.get<AdminOperationAuditList>(this.buildUrl(filters));
          }).pipe(
            tap(res => {
              this.accessDenied.set(false);
              this.list.set(res);
            }),
            catchError((err: HttpErrorResponse) => {
              this.handleListError(err);
              return EMPTY;
            }),
            finalize(() => this.isLoading.set(false))
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe();

    this.search$
      .pipe(debounceTime(400), map(q => q.trim()), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(search => this.patchFilters({ search: search || undefined }));
  }

  /** Starts loading on first call; later calls refresh, so returning to the tab shows new operations. */
  activate(): void {
    if (this.active()) {
      this.reload();
    } else {
      this.active.set(true);
    }
  }

  // ── Filters ────────────────────────────────────────────────
  setSearch(query: string): void {
    this.search$.next(query);
  }

  setDepartment(departmentId: string): void {
    this.patchFilters({ departmentId: departmentId || undefined });
  }

  setActionCode(actionCode: string): void {
    this.patchFilters({ actionCode: actionCode || undefined });
  }

  setStatus(status: string): void {
    this.patchFilters({ status: (status as AdminAuditStatus) || undefined });
  }

  setDatePreset(preset: AuditDatePreset | ''): void {
    this.patchFilters({ from: preset ? toOffsetIso(presetStart(preset)) : undefined, to: undefined });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.filters().page) return;
    this.filters.update(f => ({ ...f, page }));
  }

  reload(): void {
    this.reload$.next();
  }

  // ── Details ────────────────────────────────────────────────
  getById(id: string): Observable<AdminOperationAuditDetail> {
    return this.http.get<AdminOperationAuditDetail>(`${this.apiUrl}/${encodeURIComponent(id)}`);
  }

  // ── Helpers ────────────────────────────────────────────────
  private patchFilters(patch: Partial<AdminOperationAuditFilters>): void {
    this.filters.update(f => ({ ...f, ...patch, page: 1 }));
  }

  private handleListError(err: HttpErrorResponse): void {
    if (err.status === 403) {
      this.accessDenied.set(true);
      this.list.set(null);
      return;
    }

    if (err.status === 400) {
      this.toastr.error(err.error?.message || this.translate.instant('d3.toast.errorOp'));
      return;
    }

    this.loadFailed.set(true);
  }

  // URLSearchParams (unlike Angular's HttpParams) encodes "+" in timezone
  // offsets such as +03:00, which the API would otherwise read as a space.
  private buildUrl(filters: AdminOperationAuditFilters): string {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    });
    return `${this.apiUrl}?${params}`;
  }
}

function presetStart(preset: AuditDatePreset): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (preset === 'week') start.setDate(start.getDate() - 6);
  if (preset === 'month') start.setDate(start.getDate() - 29);
  return start;
}

// Local wall-clock time with its UTC offset, e.g. 2026-09-01T00:00:00+03:00.
function toOffsetIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
