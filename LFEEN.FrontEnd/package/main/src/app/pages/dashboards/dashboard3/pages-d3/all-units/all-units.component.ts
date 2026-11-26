import { CommonModule } from '@angular/common';
import { Component, inject, effect, signal, ChangeDetectorRef } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { DashboardSubHeaderComponent } from 'src/app/components/dashboard3/dashboard-sub-header/dashboard-sub-header.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { MetricCard, TabOption, ViewMode, BuildFilterOption } from '../../interfaces/dashboard-sub-header.model';
import { FilterItem, UnitsService, UnitSortOrder } from '../../services/units.service';
import { BuildingWithUnits, UnitTab } from '../../interfaces/unit-card.model';
import { CardsUnitsComponent } from './cards-units/cards-units.component';
import { AutoApprovalSettingsDialogComponent } from './auto-approval-settings-dialog/auto-approval-settings-dialog.component';
import { LoginService } from '../../services/login/login.service';
import { formatNumber, getVisiblePages } from 'src/app/utils/pagination.util';
import { AppPluralPipe } from 'src/app/pipes/app-plural.pipe';

@Component({
  selector: 'app-all-units',
  standalone: true,
  imports: [
    CommonModule,
    TablerIconsModule,
    TranslateModule,
    MaterialModule,
    DashboardSubHeaderComponent,
    DashboardLoadingComponent,
    DashboardEmptyComponent,
    CardsUnitsComponent,
    AppPluralPipe
  ],
  templateUrl: './all-units.component.html',
  styleUrl: './all-units.component.scss'
})
export class AllUnitsComponent {
  private unitsService = inject(UnitsService);
  private cdr          = inject(ChangeDetectorRef);
  private translate    = inject(TranslateService);
  private dialog       = inject(MatDialog);
  private login        = inject(LoginService);
  private route        = inject(ActivatedRoute);
  private router       = inject(Router);

  activeTab: string = this.unitsService.activeTab();
  searchQuery       = '';
  activeFilters: Record<string, string> | undefined;
  viewMode: ViewMode = 'list';
  buildingsWithUnits: BuildingWithUnits[] = [];
  isLoading    = false;
  /** The units request failed — shown as error + retry instead of "no units". */
  loadError    = false;
  /** The failed load was a 403 (BUG-2496). */
  loadForbidden = false;
  totalCount   = 0;
  totalPages   = 1;
  currentPage  = 1;

  metrics: MetricCard[] = [
    { titleKey: 'd3.allUnits.cards.totalUnits',        value: '—', icon: 'building',     tone: 'black'  },
    { titleKey: 'd3.allUnits.cards.activeUnits',      value: '—', icon: 'circle-check', tone: 'green'  },
    { titleKey: 'd3.allUnits.cards.unpublishedUnits',  value: '—', icon: 'player-pause', tone: 'gray'   },
    { titleKey: 'd3.allUnits.cards.underReviewUnits', value: '—', icon: 'clock-hour-3', tone: 'orange' }
  ];

  tabs: TabOption[] = [
    { id: 'draft',       labelKey: 'd3.allUnits.tabs.draft'       },
    { id: 'published',   labelKey: 'd3.allUnits.tabs.published'   },
    { id: 'new',         labelKey: 'd3.allUnits.tabs.new'         },
    { id: 'underReview', labelKey: 'd3.allUnits.tabs.underReview' },
    { id: 'pendingChanges', labelKey: 'd3.allUnits.tabs.pendingChanges' },
    { id: 'rejected',    labelKey: 'd3.allUnits.tabs.rejected'    },
    { id: 'banned',      labelKey: 'd3.allUnits.tabs.banned'      }
  ];

  filterOptions: BuildFilterOption[] = [
    {
      id: 'account',
      labelKey: 'd3.allUnits.filters.allAccounts',
      items: [{ value: 'all', labelKey: 'd3.allUnits.filters.allAccounts' }]
    },
    {
      id: 'property',
      labelKey: 'd3.allUnits.filters.allProperties',
      items: [{ value: 'all', labelKey: 'd3.allUnits.filters.allProperties' }]
    },
    {
      id: 'sort',
      labelKey: 'd3.allUnits.filters.sortNewest',
      items: [
        { value: 'newest',           labelKey: 'd3.allUnits.filters.sortNewest'           },
        { value: 'oldest',           labelKey: 'd3.allUnits.filters.sortOldest'           },
        { value: 'highestOccupancy', labelKey: 'd3.allUnits.filters.sortHighestOccupancy' },
      ]
    }
  ];

  searchPlaceholder = 'd3.allUnits.filters.searchPlaceholder';

  /** The building and account dropdowns load one page and search on the server. */
  readonly serverSearchFilterIds = ['account', 'property'];

  private readonly propertyFilterSearch = signal('');
  private readonly accountFilterSearch  = signal('');
  /** Kept so the chosen entry stays in its dropdown (and on the pill) when a search doesn't return it. */
  private readonly selectedPropertyItem = signal<FilterItem | null>(null);
  private readonly selectedAccountItem  = signal<FilterItem | null>(null);

  // Owned by this component (not the root UnitsService) so leaving the page cancels any
  // filter request still in flight; a new search term cancels the previous one.
  private readonly propertiesFilterResource = rxResource({
    request: () => this.propertyFilterSearch(),
    loader: ({ request }) => this.unitsService.searchPropertiesForFilter(request),
  });
  private readonly accountsFilterResource = rxResource({
    request: () => this.accountFilterSearch(),
    loader: ({ request }) => this.unitsService.searchAccountsForFilter(request),
  });

  onFilterSearch(change: { filterId: string; term: string }): void {
    if (change.filterId === 'property') this.propertyFilterSearch.set(change.term);
    if (change.filterId === 'account')  this.accountFilterSearch.set(change.term);
  }

  private withSelected(items: FilterItem[], selected: FilterItem | null): FilterItem[] {
    if (!selected || items.some(i => i.value === selected.value)) return items;
    return [selected, ...items];
  }

  private findFilterItem(filterId: string, value: string): FilterItem | null {
    if (!value) return null;
    const item = this.filterOptions.find(f => f.id === filterId)?.items.find(i => i.value === value);
    return item ? { value: item.value, labelKey: item.labelKey } : null;
  }

  retryLoad(): void {
    this.unitsService.reload();
  }

  constructor() {
    this.applyTabFromUrl();

    // sync main data
    effect(() => {
      this.buildingsWithUnits = this.unitsService.paginatedBuildings();
      this.isLoading   = this.unitsService.isLoading();
      this.loadError   = this.unitsService.loadFailed();
      this.loadForbidden = this.unitsService.loadForbidden();
      this.totalCount  = this.unitsService.totalCount();
      this.totalPages  = this.unitsService.totalBuildingPages();
      this.currentPage = this.unitsService.buildingsPage();

      const s = this.unitsService.unitStats();
      if (this.unitsService.statsFailed()) {
        // "—" rather than stale or zero figures when the stats request failed.
        this.metrics = this.metrics.map(m => ({ ...m, value: '—' }));
      } else if (s) {
        this.metrics = [
          { ...this.metrics[0], value: formatNumber(s.total)             },
          { ...this.metrics[1], value: formatNumber(s.activeOrPublished) },
          { ...this.metrics[2], value: formatNumber(s.pendingOrRejected) },
          { ...this.metrics[3], value: formatNumber(s.underReview)       },
        ];
        // stats aren't affected by the active filter, so this count holds on every tab.
        this.tabs = this.tabs.map(t => t.id === 'banned' ? { ...t, count: s.banned ?? null } : t);
      }

      this.cdr.markForCheck();
    });

    // sync filter dropdowns from the server-searched results
    effect(() => {
      const accounts   = this.withSelected(
        this.unitsService.toAccountFilterItems(this.accountsFilterResource.value() ?? []),
        this.selectedAccountItem(),
      );
      const properties = this.withSelected(this.propertiesFilterResource.value() ?? [], this.selectedPropertyItem());
      this.filterOptions = this.filterOptions.map(f => {
        if (f.id === 'account') {
          return {
            ...f,
            items: [
              { value: 'all', labelKey: 'd3.allUnits.filters.allAccounts' },
              ...accounts,
            ]
          };
        }
        if (f.id === 'property') {
          return {
            ...f,
            items: [
              { value: 'all', labelKey: 'd3.allUnits.filters.allProperties' },
              ...properties,
            ]
          };
        }
        return f;
      });
      this.cdr.markForCheck();
    });
  }

  // A link may ask for a tab (e.g. a unit notification whose unit couldn't be opened lands
  // on "pending changes"). The param is dropped once applied so it doesn't stick around
  // after the admin switches tabs.
  private applyTabFromUrl(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (!tab || !this.tabs.some(t => t.id === tab)) return;
    this.onTabChange(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  /** Units.ManageSettings — only SuperAdmin has it by default. */
  get canManageSettings(): boolean {
    return this.login.permissions().some(p => p.toLowerCase() === 'units.managesettings');
  }

  openAutoApprovalSettings(): void {
    if (!this.canManageSettings) return;
    this.dialog.open(AutoApprovalSettingsDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
      autoFocus: 'dialog',
    });
  }

  get isReviewTab(): boolean {
    return this.activeTab === 'new' || this.activeTab === 'underReview' || this.activeTab === 'pendingChanges';
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
    this.unitsService.setTab(tab as UnitTab);
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    this.unitsService.setSearch(query);
  }

  /** Search / account / property narrow the list; sort only reorders it, so it doesn't count. */
  get hasFilters(): boolean {
    return !!(this.unitsService.searchQuery().trim() || this.unitsService.accountId() || this.unitsService.propertyId());
  }

  clearFilters(): void {
    this.onSearch('');
    // A new object each time so the dropdown pills pick up the reset.
    this.activeFilters = { account: 'all', property: 'all' };
    this.selectedAccountItem.set(null);
    this.selectedPropertyItem.set(null);
    this.unitsService.setAccountFilter('');
    this.unitsService.setPropertyFilter('');
  }

  onFiltersChange(filters: Record<string, string>): void {
    const accountId  = filters['account']  === 'all' ? '' : (filters['account']  ?? '');
    const propertyId = filters['property'] === 'all' ? '' : (filters['property'] ?? '');
    const sort       = (filters['sort'] ?? 'newest') as UnitSortOrder;
    this.selectedAccountItem.set(this.findFilterItem('account', accountId));
    this.selectedPropertyItem.set(this.findFilterItem('property', propertyId));
    this.unitsService.setAccountFilter(accountId);
    this.unitsService.setPropertyFilter(propertyId);
    this.unitsService.setSortOrder(sort);
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.unitsService.goToBuildingPage(page);
  }
}
