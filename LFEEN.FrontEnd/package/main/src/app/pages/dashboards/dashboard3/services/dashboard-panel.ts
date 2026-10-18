import { DestroyRef, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subscription } from 'rxjs';
import { DashboardFilters } from '../pages-d3/ceo-page/interfaces/dashboard.model';

export interface DashboardPanel<T> {
  data: Signal<T | null>;
  loading: Signal<boolean>;
  error: Signal<HttpErrorResponse | null>;
  /** Loading with nothing to show yet (previous data stays visible while refetching). */
  initialLoading: Signal<boolean>;
  reload: () => void;
}

const MAX_RETRIES = 2;

/**
 * Independent state for one dashboard panel: refetches when filters change,
 * cancels the obsolete request, keeps previous data while refetching, and
 * retries only 500/502 (never 400/401/403).
 * Must be called in an injection context.
 */
export function createDashboardPanel<T>(
  filters: Signal<DashboardFilters>,
  fetcher: (filters: DashboardFilters) => Observable<T>
): DashboardPanel<T> {
  const data = signal<T | null>(null);
  const loading = signal(false);
  const error = signal<HttpErrorResponse | null>(null);
  const trigger = signal(0);
  let sub: Subscription | null = null;
  let destroyed = false;

  const run = (f: DashboardFilters, attempt = 0) => {
    sub?.unsubscribe();
    loading.set(true);
    error.set(null);
    sub = fetcher(f).subscribe({
      next: (res) => {
        data.set(res);
        loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        if ((err.status === 500 || err.status === 502) && attempt < MAX_RETRIES) {
          setTimeout(() => !destroyed && run(f, attempt + 1), 1000 * (attempt + 1));
          return;
        }
        error.set(err);
        loading.set(false);
      },
    });
  };

  effect(() => {
    const f = filters();
    trigger();
    untracked(() => run(f));
  });

  inject(DestroyRef).onDestroy(() => {
    destroyed = true;
    sub?.unsubscribe();
  });

  return {
    data,
    loading,
    error,
    initialLoading: computed(() => loading() && data() === null),
    reload: () => trigger.update((n) => n + 1),
  };
}
