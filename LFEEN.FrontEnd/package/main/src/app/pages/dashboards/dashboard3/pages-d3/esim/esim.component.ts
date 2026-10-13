import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs/operators';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import { LoginService } from '../../services/login/login.service';
import { DeleteConfirmDialogComponent } from '../team-management/components/delete-confirm-dialog/delete-confirm-dialog.component';
import {
  EMPTY_ESIM_FILTERS, ESIM_NETWORK_OPTIONS, EsimDestinationOption, EsimDetail, EsimFilters, EsimListItem,
  EsimListQuery, EsimScope, EsimStateAction, EsimStatusBucket, EsimSummary,
  esimDurationKey, esimIsUnlimited, esimStatusKey,
} from './interfaces/esim.model';
import { resolveEsimError } from './interfaces/esim-error.util';
import { EsimService } from './services/esim.service';
import { EsimDetailDrawerComponent } from './esim-detail-drawer/esim-detail-drawer.component';
import { EsimFilterDialogComponent } from './esim-filter-dialog/esim-filter-dialog.component';

type ScopeTab = EsimScope | 'all';

interface EsimRow {
  id: string;
  initials: string;
  userName: string;
  email: string;
  purchasedAt: Date | null;
  coverageName: string;
  coverageCode: string;
  scope: EsimScope;
  planLabel: string;
  isUnlimited: boolean;
  networkType: string;
  carrier: string;
  volumeText: string;
  duration: number;
  durationUnit: string;
  price: number;
  status: EsimStatusBucket;
  expiresAt: Date | null;
}

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;

@Component({
  selector: 'app-esim',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent, EsimDetailDrawerComponent, EsimFilterDialogComponent],
  templateUrl: './esim.component.html',
  styleUrl: './esim.component.scss'
})
export class EsimComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private dialog = inject(MatDialog);
  private login = inject(LoginService);
  private service = inject(EsimService);

  currentLang = this.translate.currentLang || 'ar';
  activeTab: ScopeTab = 'all';
  filters: EsimFilters = { ...EMPTY_ESIM_FILTERS };
  filterOpen = false;
  /**
   * There's no destinations endpoint, so the dialog offers every destination seen in the
   * pages loaded so far (cleared on language change, since names are localized).
   */
  private destinations = new Map<string, string>();
  coverageOptions: EsimDestinationOption[] = [];
  readonly networkOptions = ESIM_NETWORK_OPTIONS;
  searchQuery = '';
  private searchInput$ = new Subject<string>();
  currentPage = 1;

  loading = false;
  loadError = false;

  summary: EsimSummary | null = null;
  /** SIM shown in the detail drawer; null = drawer closed. */
  selectedSim: EsimDetail | null = null;
  pagedRows: EsimRow[] = [];
  totalCount = 0;
  private scopeCounts: Record<EsimScope, number> = { Global: 0, Regional: 0, Local: 0 };
  /** esimId with a state change in flight — its row actions are disabled meanwhile. */
  actingId: string | null = null;

  private listRequest?: Subscription;
  private summaryRequest?: Subscription;
  private detailRequest?: Subscription;

  readonly tabs: { value: ScopeTab; labelKey: string }[] = [
    { value: 'all', labelKey: 'd3.esim.tabs.all' },
    { value: 'Global', labelKey: 'd3.esim.scope.global' },
    { value: 'Regional', labelKey: 'd3.esim.scope.regional' },
    { value: 'Local', labelKey: 'd3.esim.scope.local' },
  ];

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLang = event.lang;
        // Destination names, volume text and plan labels are localized server-side.
        this.destinations.clear();
        this.coverageOptions = [];
        this.loadList();
        if (this.selectedSim) this.openDetail(this.selectedSim.esimId);
      });

    this.searchInput$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), map(v => v.trim()), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentPage = 1;
        this.loadList();
      });
  }

  ngOnInit(): void {
    this.load();
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get canManageState(): boolean {
    return this.login.permissions().some(p => p.toLowerCase() === 'esim.managestate');
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  /** Deltas read with an explicit sign, e.g. "+12". */
  fmtSigned(value: number): string {
    return `${value > 0 ? '+' : ''}${this.fmt(value)}`;
  }

  fmtAmount(value: number): string {
    return value.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  fmtSignedAmount(value: number): string {
    return `${value > 0 ? '+' : ''}${this.fmtAmount(value)}`;
  }

  fmtDate(date: Date | null): string {
    if (!date) return '-';
    return format(date, 'd MMMM yyyy', { locale: this.currentLang === 'en' ? enUS : ar });
  }

  durationKey(row: EsimRow): string {
    return esimDurationKey(row.duration, row.durationUnit);
  }

  statusKey(status: EsimStatusBucket): string {
    return esimStatusKey(status);
  }

  load(): void {
    this.loadSummary();
    this.loadList();
  }

  private loadSummary(): void {
    this.summaryRequest?.unsubscribe();
    this.summaryRequest = this.service.getSummary().subscribe({
      next: summary => { this.summary = summary; },
      error: () => { this.summary = null; },
    });
  }

  private loadList(): void {
    this.listRequest?.unsubscribe();
    this.loading = true;
    this.loadError = false;

    this.listRequest = this.service.getList(this.buildQuery(this.filters, this.currentPage, PAGE_SIZE)).subscribe({
      next: res => {
        this.pagedRows = res.items.map(i => this.toRow(i));
        this.totalCount = res.total;
        this.scopeCounts = { Global: res.globalCount, Regional: res.regionalCount, Local: res.localCount };
        this.rememberDestinations(res.items);
        this.loading = false;
        // The page can fall off the end after a filter change or a revoke elsewhere.
        if (this.currentPage > this.totalPages) this.changePage(this.totalPages);
      },
      error: () => {
        this.pagedRows = [];
        this.totalCount = 0;
        this.scopeCounts = { Global: 0, Regional: 0, Local: 0 };
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  private buildQuery(f: EsimFilters, page: number, pageSize: number): EsimListQuery {
    return {
      page,
      pageSize,
      destinationType: this.activeTab === 'all' ? undefined : this.activeTab,
      statusBucket: f.status === 'all' ? undefined : f.status,
      destinationCode: f.destination === 'all' ? undefined : f.destination,
      networkType: f.network === 'all' ? undefined : f.network,
      search: this.searchQuery.trim() || undefined,
    };
  }

  tabCount(tab: ScopeTab): number {
    const c = this.scopeCounts;
    return tab === 'all' ? c.Global + c.Regional + c.Local : c[tab];
  }

  setActiveTab(tab: ScopeTab): void {
    if (tab === this.activeTab) return;
    this.activeTab = tab;
    this.currentPage = 1;
    this.loadList();
  }

  get hasActiveFilters(): boolean {
    const f = this.filters;
    return f.status !== 'all' || f.destination !== 'all' || f.network !== 'all';
  }

  /** Total a filter selection would show under the current tab and search — previewed by the filter dialog. */
  readonly countFor = (filters: EsimFilters): Observable<number> =>
    this.service.getList(this.buildQuery(filters, 1, 1)).pipe(map(res => res.total));

  onFiltersApplied(filters: EsimFilters): void {
    this.filters = filters;
    this.filterOpen = false;
    this.currentPage = 1;
    this.loadList();
  }

  clearFilters(): void {
    this.filters = { ...EMPTY_ESIM_FILTERS };
    this.searchQuery = '';
    this.searchInput$.next('');
    this.currentPage = 1;
    this.loadList();
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.searchInput$.next(value);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / PAGE_SIZE));
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadList();
  }

  onView(row: EsimRow): void {
    this.openDetail(row.id);
  }

  private openDetail(esimId: string): void {
    this.detailRequest?.unsubscribe();
    this.detailRequest = this.service.getDetail(esimId).subscribe({
      next: detail => { this.selectedSim = detail; },
      error: err => {
        const e = err as { status?: number };
        // A network failure gets the drawer-specific copy; API errors carry their own message.
        this.toastr.error(!e?.status || e.status >= 500
          ? this.translate.instant('d3.esim.errors.detail')
          : resolveEsimError(err, this.translate));
      },
    });
  }

  onDrawerClosed(): void {
    this.detailRequest?.unsubscribe();
    this.selectedSim = null;
  }

  // ── State change (suspend / unsuspend / revoke) ───────────────

  canSuspend(row: EsimRow): boolean {
    return row.status === 'Active';
  }

  canUnsuspend(row: EsimRow): boolean {
    return row.status === 'Suspended';
  }

  canRevoke(row: EsimRow): boolean {
    return row.status !== 'Expired';
  }

  onChangeState(row: EsimRow, action: EsimStateAction): void {
    if (this.actingId) return;
    if (action !== 'revoke') {
      this.runStateChange(row.id, action);
      return;
    }
    // revoke is final and never refunded by the provider — confirm first.
    this.dialog.open(DeleteConfirmDialogComponent, {
      width: '420px',
      data: { title: 'd3.esim.actions.revokeConfirmTitle', message: 'd3.esim.actions.revokeConfirmMessage' },
    }).afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.runStateChange(row.id, 'revoke'));
  }

  private runStateChange(esimId: string, action: EsimStateAction): void {
    this.actingId = esimId;
    this.service.changeState(esimId, action).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.actingId = null;
        this.toastr.success(this.translate.instant(`d3.esim.actions.${action}Success`));
        // The response is intentionally thin — re-fetch instead of patching the UI from it.
        this.load();
        if (this.selectedSim?.esimId === esimId) this.openDetail(esimId);
      },
      error: err => {
        this.actingId = null;
        this.toastr.error(resolveEsimError(err, this.translate));
      },
    });
  }

  private rememberDestinations(items: EsimListItem[]): void {
    let added = false;
    for (const i of items) {
      if (i.destinationCode && !this.destinations.has(i.destinationCode)) {
        this.destinations.set(i.destinationCode, i.destinationName);
        added = true;
      }
    }
    if (added) {
      this.coverageOptions = [...this.destinations]
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.name.localeCompare(b.name, this.currentLang));
    }
  }

  private toRow(s: EsimListItem): EsimRow {
    const userName = s.userName?.trim() || '-';
    return {
      id: s.esimId,
      initials: this.initialsOf(s.userName ?? ''),
      userName,
      email: s.userEmail ?? '-',
      purchasedAt: parseApiUtc(s.createdAtUtc),
      coverageName: s.destinationName,
      coverageCode: s.destinationCode,
      scope: s.destinationType,
      planLabel: s.dataPlanLabel,
      isUnlimited: esimIsUnlimited(s.dataPlanLabel),
      networkType: s.networkType ?? '-',
      carrier: s.operatorsSummary ?? '-',
      volumeText: s.totalVolumeText,
      duration: s.totalDuration,
      durationUnit: s.durationUnit,
      price: s.priceSar,
      status: s.statusBucket,
      expiresAt: parseApiUtc(s.expiresAtUtc),
    };
  }

  private initialsOf(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '-';
    const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
    return letters.toUpperCase();
  }
}
