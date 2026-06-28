import { CommonModule } from '@angular/common';
import { Component, inject, effect, ChangeDetectorRef } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardSubHeaderComponent } from 'src/app/components/dashboard3/dashboard-sub-header/dashboard-sub-header.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { MetricCard, TabOption, ViewMode, BuildFilterOption } from '../../interfaces/dashboard-sub-header.model';
import { UnitsService, UnitSortOrder } from '../../services/units.service';
import { BuildingWithUnits, UnitTab } from '../../interfaces/unit-card.model';
import { CardsUnitsComponent } from './cards-units/cards-units.component';

@Component({
  selector: 'app-all-units',
  standalone: true,
  imports: [
    CommonModule,
    TablerIconsModule,
    TranslateModule,
    DashboardSubHeaderComponent,
    DashboardLoadingComponent,
    CardsUnitsComponent
  ],
  templateUrl: './all-units.component.html',
  styleUrl: './all-units.component.scss'
})
export class AllUnitsComponent {
  private unitsService = inject(UnitsService);
  private cdr          = inject(ChangeDetectorRef);
  private translate    = inject(TranslateService);

  activeTab: string = this.unitsService.activeTab();
  searchQuery       = '';
  viewMode: ViewMode = 'grid';
  buildingsWithUnits: BuildingWithUnits[] = [];
  isLoading    = false;
  totalCount   = 0;
  totalPages   = 1;
  currentPage  = 1;

  metrics: MetricCard[] = [
    { titleKey: 'd3.allUnits.cards.totalUnits',        value: '—', icon: 'building',     tone: 'black'  },
    { titleKey: 'd3.allUnits.cards.activeUnits',      value: '—', icon: 'circle-check', tone: 'green'  },
    { titleKey: 'd3.allUnits.cards.stoppedUnits',     value: '—', icon: 'player-pause', tone: 'gray'   },
    { titleKey: 'd3.allUnits.cards.underReviewUnits', value: '—', icon: 'clock-hour-3', tone: 'orange' }
  ];

  tabs: TabOption[] = [
    { id: 'published',   labelKey: 'd3.allUnits.tabs.published'   },
    { id: 'new',         labelKey: 'd3.allUnits.tabs.new'         },
    { id: 'underReview', labelKey: 'd3.allUnits.tabs.underReview' },
    { id: 'pendingChanges', labelKey: 'd3.allUnits.tabs.pendingChanges' },
    { id: 'rejected',    labelKey: 'd3.allUnits.tabs.rejected'    }
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

  constructor() {
    // sync main data
    effect(() => {
      this.buildingsWithUnits = this.unitsService.paginatedBuildings();
      this.isLoading   = this.unitsService.isLoading();
      this.totalCount  = this.unitsService.totalCount();
      this.totalPages  = this.unitsService.totalBuildingPages();
      this.currentPage = this.unitsService.buildingsPage();

      const s = this.unitsService.unitStats();
      if (s) {
        this.metrics = [
          { ...this.metrics[0], value: this.formatNumber(s.total)             },
          { ...this.metrics[1], value: this.formatNumber(s.activeOrPublished) },
          { ...this.metrics[2], value: this.formatNumber(s.pendingOrRejected) },
          { ...this.metrics[3], value: this.formatNumber(s.underReview)       },
        ];
      }

      this.cdr.markForCheck();
    });

    // sync filter dropdowns from loaded units (reactive — updates on data changes)
    effect(() => {
      const accounts   = this.unitsService.accountsForFilter();
      const properties = this.unitsService.propertiesForFilter();
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

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat().format(value);
  }

  get visiblePages(): (number | '...')[] {
    const n = this.totalPages;
    const c = this.currentPage;
    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    if (c <= 4)     return [1, 2, 3, 4, '...', n - 2, n - 1, n];
    if (c >= n - 3) return [1, 2, 3, '...', n - 3, n - 2, n - 1, n];
    return [1, 2, 3, '...', c, '...', n - 2, n - 1, n];
  }

  get isReviewTab(): boolean {
    return this.activeTab === 'new' || this.activeTab === 'underReview' || this.activeTab === 'pendingChanges' || this.activeTab === 'rejected';
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
    this.unitsService.setTab(tab as UnitTab);
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    this.unitsService.setSearch(query);
  }

  onFiltersChange(filters: Record<string, string>): void {
    const accountId  = filters['account']  === 'all' ? '' : (filters['account']  ?? '');
    const propertyId = filters['property'] === 'all' ? '' : (filters['property'] ?? '');
    const sort       = (filters['sort'] ?? 'newest') as UnitSortOrder;
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
