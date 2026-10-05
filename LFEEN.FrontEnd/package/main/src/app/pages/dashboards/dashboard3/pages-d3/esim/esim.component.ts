import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import {
  EMPTY_ESIM_FILTERS, EsimDetail, EsimFilters, EsimPlanType, EsimScope, EsimStatus, EsimSubscription, EsimSummary,
  esimNetworkGenerations, esimValidityKey,
} from './interfaces/esim.model';
import { EsimService } from './services/esim.service';
import { EsimDetailDrawerComponent } from './esim-detail-drawer/esim-detail-drawer.component';
import { EsimFilterDialogComponent } from './esim-filter-dialog/esim-filter-dialog.component';

type ScopeTab = EsimScope | 'all';

interface EsimRow {
  id: string;
  initials: string;
  userName: string;
  email: string;
  phone: string;
  purchasedAt: Date | null;
  coverageName: string;
  coverageCode: string;
  scope: EsimScope;
  planType: EsimPlanType;
  networkType: string;
  carrier: string;
  dataGb: number;
  validityDays: number;
  price: number;
  status: EsimStatus;
  activatedAt: Date | null;
  expiresAt: Date | null;
  searchText: string;
}

const PAGE_SIZE = 5;

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
  private service = inject(EsimService);

  currentLang = this.translate.currentLang || 'ar';
  activeTab: ScopeTab = 'all';
  filters: EsimFilters = { ...EMPTY_ESIM_FILTERS };
  filterOpen = false;
  /** Distinct values present in the loaded rows, offered by the filter dialog. */
  coverageOptions: string[] = [];
  networkOptions: string[] = [];
  searchQuery = '';
  currentPage = 1;

  loading = false;
  loadError = false;

  summary: EsimSummary | null = null;
  /** SIM shown in the detail drawer; null = drawer closed. */
  selectedSim: EsimDetail | null = null;
  private allRows: EsimRow[] = [];
  private filtered: EsimRow[] = [];
  pagedRows: EsimRow[] = [];

  private listRequest?: Subscription;

  readonly tabs: { value: ScopeTab; labelKey: string }[] = [
    { value: 'all', labelKey: 'd3.esim.tabs.all' },
    { value: 'Global', labelKey: 'd3.esim.scope.global' },
    { value: 'Regional', labelKey: 'd3.esim.scope.regional' },
    { value: 'Local', labelKey: 'd3.esim.scope.local' },
  ];

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });
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

  /** Share of all SIMs that are active, 0–100. */
  get activePercent(): number {
    const s = this.summary;
    return s?.totalSims ? Math.round((s.activeSims / s.totalSims) * 100) : 0;
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

  fmtDate(date: Date | null): string {
    if (!date) return '-';
    return format(date, 'd MMMM yyyy', { locale: this.currentLang === 'en' ? enUS : ar });
  }

  validityKey(days: number): string {
    return esimValidityKey(days);
  }

  onView(row: EsimRow): void {
    this.service.getDetail(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => { this.selectedSim = detail; },
      error: () => { this.toastr.error(this.translate.instant('d3.esim.errors.detail')); },
    });
  }

  load(): void {
    this.listRequest?.unsubscribe();
    this.loading = true;
    this.loadError = false;

    this.listRequest = this.service.getOverview().subscribe({
      next: ({ summary, items }) => {
        this.summary = summary;
        this.allRows = items.map(i => this.toRow(i));
        this.coverageOptions = [...new Set(this.allRows.map(r => r.coverageName))];
        this.networkOptions = [...new Set(this.allRows.flatMap(r => esimNetworkGenerations(r.networkType)))].sort();
        this.loading = false;
        this.applyFilters();
      },
      error: () => {
        this.summary = null;
        this.allRows = [];
        this.coverageOptions = [];
        this.networkOptions = [];
        this.loading = false;
        this.loadError = true;
        this.applyFilters();
      },
    });
  }

  tabCount(tab: ScopeTab): number {
    return tab === 'all' ? this.allRows.length : this.allRows.filter(r => r.scope === tab).length;
  }

  setActiveTab(tab: ScopeTab): void {
    if (tab === this.activeTab) return;
    this.activeTab = tab;
    this.currentPage = 1;
    this.applyFilters();
  }

  get hasActiveFilters(): boolean {
    const f = this.filters;
    return f.status !== 'all' || f.coverage !== 'all' || f.network !== 'all';
  }

  /** Rows a filter selection would show under the current tab and search — previewed by the filter dialog. */
  readonly countFor = (filters: EsimFilters): number => this.allRows.filter(r => this.matches(r, filters)).length;

  onFiltersApplied(filters: EsimFilters): void {
    this.filters = filters;
    this.filterOpen = false;
    this.currentPage = 1;
    this.applyFilters();
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.currentPage = 1;
    this.applyFilters();
  }

  get totalCount(): number {
    return this.filtered.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / PAGE_SIZE));
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePage();
  }

  private toRow(s: EsimSubscription): EsimRow {
    return {
      id: s.id,
      initials: this.initialsOf(s.userName),
      userName: s.userName,
      email: s.email,
      phone: s.phone,
      purchasedAt: parseApiUtc(s.purchasedAtUtc),
      coverageName: s.coverageName,
      coverageCode: s.coverageCode,
      scope: s.scope,
      planType: s.planType,
      networkType: s.networkType,
      carrier: s.carrier,
      dataGb: s.dataGb,
      validityDays: s.validityDays,
      price: s.price,
      status: s.status,
      activatedAt: parseApiUtc(s.activatedAtUtc),
      expiresAt: parseApiUtc(s.expiresAtUtc),
      searchText: `${s.userName} ${s.email} ${s.phone} ${s.phone.replace(/\s+/g, '')}`.toLowerCase(),
    };
  }

  private initialsOf(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '-';
    const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
    return letters.toUpperCase();
  }

  private matches(r: EsimRow, f: EsimFilters): boolean {
    const q = this.searchQuery.trim().toLowerCase();
    return (this.activeTab === 'all' || r.scope === this.activeTab) &&
      (f.status === 'all' || r.status === f.status) &&
      (f.coverage === 'all' || r.coverageName === f.coverage) &&
      (f.network === 'all' || esimNetworkGenerations(r.networkType).includes(f.network)) &&
      (!q || r.searchText.includes(q));
  }

  private applyFilters(): void {
    this.filtered = this.allRows.filter(r => this.matches(r, this.filters));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    this.updatePage();
  }

  private updatePage(): void {
    const start = (this.currentPage - 1) * PAGE_SIZE;
    this.pagedRows = this.filtered.slice(start, start + PAGE_SIZE);
  }
}
