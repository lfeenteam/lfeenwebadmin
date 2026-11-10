import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, map } from 'rxjs/operators';
import { MaterialModule } from 'src/app/material.module';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatLocalizedNumber, getVisiblePages } from 'src/app/utils/pagination.util';
import { LoginService } from '../../services/login/login.service';
import { DemoAccountsService } from '../../services/demo-accounts.service';
import {
  DEMO_CHANNEL_ICONS,
  DEMO_LIMITS,
  DEMO_PERMISSIONS,
  DEMO_STATUSES,
  DemoAccount,
  DemoAccountStatus,
  DemoChannel,
  toLocalPhone
} from '../../interfaces/demo-account.model';
import { demoErrorMessage, formatRiyadhDate, readDemoError } from './demo-accounts.util';
import { DEMO_DEFAULT_PAGE_SIZE, DEMO_PAGE_SIZES, demoListState } from './demo-list-state';
import { DemoTabsComponent } from './components/demo-tabs/demo-tabs.component';

const EMPTY = '—';

@Component({
  selector: 'app-demo-accounts',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent, DemoTabsComponent],
  templateUrl: './demo-accounts.component.html',
  styleUrl: './demo-accounts.component.scss'
})
export class DemoAccountsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly service = inject(DemoAccountsService);
  private readonly login = inject(LoginService);

  readonly canManage = computed(() =>
    this.login.permissions().some(p => p.toLowerCase() === DEMO_PERMISSIONS.manage)
  );

  readonly statuses = DEMO_STATUSES;
  // mat-select shows nothing for a null value, so "All" gets its own option value.
  readonly allStatuses = 'all';
  readonly channelIcons = DEMO_CHANNEL_ICONS;
  readonly searchMax = DEMO_LIMITS.search;
  readonly emptyValue = EMPTY;

  currentLang = this.translate.currentLang || 'ar';

  // Mirrors the URL query (?search=&status=&page=&size=) — the URL is the source of truth.
  searchText = '';
  status: DemoAccountStatus | null = null;
  page = 1;
  pageSize: number = DEMO_DEFAULT_PAGE_SIZE;
  readonly pageSizes = DEMO_PAGE_SIZES;

  items: DemoAccount[] = [];
  totalCount = 0;
  totalPages = 1;

  loading = false;
  loadError: string | null = null;
  /** The feature is off on the backend (DEMO_DISABLED): banner, empty table, create disabled. */
  demoDisabled = false;

  private readonly searchInput$ = new Subject<string>();
  private listRequest?: Subscription;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const status = params.get('status') as DemoAccountStatus | null;
      const page = Number(params.get('page'));
      const size = Number(params.get('size'));
      this.searchText = (params.get('search') ?? '').slice(0, DEMO_LIMITS.search);
      this.status = status && DEMO_STATUSES.includes(status) ? status : null;
      this.page = Number.isInteger(page) && page > 0 ? page : 1;
      this.pageSize = (DEMO_PAGE_SIZES as readonly number[]).includes(size) ? size : DEMO_DEFAULT_PAGE_SIZE;
      // Remembered for the details page's back button.
      demoListState.query = Object.fromEntries(
        ['search', 'status', 'page', 'size'].filter(k => params.get(k)).map(k => [k, params.get(k)!])
      );
      this.load();
    });

    this.searchInput$
      .pipe(
        map(v => v.trim()),
        debounceTime(400),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(search => {
        if (search !== this.searchText) this.updateQuery({ search: search || null, page: null });
      });
  }

  get dir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get hasFilters(): boolean {
    return !!this.searchText || !!this.status;
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.page, this.totalPages);
  }

  load(): void {
    this.listRequest?.unsubscribe();
    this.loading = true;
    this.loadError = null;

    this.listRequest = this.service.list({
      search: this.searchText || null,
      status: this.status,
      pageNumber: this.page,
      pageSize: this.pageSize,
    }).subscribe({
      next: res => {
        this.demoDisabled = false;
        this.items = res.items ?? [];
        this.totalCount = res.totalCount ?? 0;
        this.totalPages = Math.max(1, res.totalPages ?? 1);
        this.loading = false;
        // A page past the end (stale bookmark, rows removed) → go to the last real page.
        if (!this.items.length && this.page > this.totalPages) {
          this.updateQuery({ page: this.totalPages > 1 ? this.totalPages : null });
        }
      },
      error: err => {
        const e = readDemoError(err);
        this.items = [];
        this.totalCount = 0;
        this.totalPages = 1;
        this.loading = false;
        this.demoDisabled = e.code === 'DEMO_DISABLED';
        if (!this.demoDisabled) this.loadError = demoErrorMessage(e, this.translate);
      },
    });
  }

  onSearchInput(value: string): void {
    this.searchInput$.next(value);
  }

  onStatusChange(value: string): void {
    this.updateQuery({ status: value === this.allStatuses ? null : value, page: null });
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) return;
    this.updateQuery({ page: page === 1 ? null : page });
  }

  /** 20 / 50 / 100 rows; back to page 1. */
  onPageSizeChange(size: number): void {
    this.updateQuery({ size: size === DEMO_DEFAULT_PAGE_SIZE ? null : size, page: null });
  }

  clearFilters(): void {
    this.updateQuery({ search: null, status: null, page: null });
  }

  // Row click and the ⋮ menu's only item (§4.1: every other action lives on the details page).
  open(item: DemoAccount): void {
    this.router.navigate(['/', this.currentLang, 'd3', 'demo-accounts', item.id]);
  }

  // The create form has its own page (/demo-accounts/new): it holds the invitation editor and preview.
  openCreate(): void {
    if (!this.canManage() || this.demoDisabled) return;
    this.router.navigate(['/', this.currentLang, 'd3', 'demo-accounts', 'new']);
  }

  // ── Display helpers ────────────────────────────────────────

  statusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  statusLabel(status: string): string {
    const key = `d3.demoAccounts.status.${status}`;
    const label = this.translate.instant(key);
    return label === key ? status : label;
  }

  channelLabel(channel: DemoChannel): string {
    const key = `d3.demoAccounts.channels.${channel}`;
    const label = this.translate.instant(key);
    return label === key ? channel : label;
  }

  phone(value: string | null): string {
    return toLocalPhone(value) ?? EMPTY;
  }

  date(value: string | null): string {
    return formatRiyadhDate(value, this.currentLang) ?? EMPTY;
  }

  daysLeft(item: DemoAccount): string | null {
    if (item.status === 'Expired' || item.status === 'Disabled') return null;
    return formatLocalizedNumber(Math.max(0, item.daysLeft ?? 0), this.currentLang);
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  private updateQuery(changes: Record<string, string | number | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
    });
  }
}
