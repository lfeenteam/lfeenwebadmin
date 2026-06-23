import { CommonModule } from '@angular/common';
import { Component, inject, effect, ChangeDetectorRef } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardSubHeaderComponent } from 'src/app/components/dashboard3/dashboard-sub-header/dashboard-sub-header.component';
import { MetricCard, TabOption, ViewMode, BuildFilterOption } from '../../interfaces/dashboard-sub-header.model';
import { UnitsService } from '../../services/units.service';
import { BuildingWithUnits, UnitApiItem, UnitTab } from '../../interfaces/unit-card.model';
import { CardsUnitsComponent } from './cards-units/cards-units.component';

@Component({
  selector: 'app-all-units',
  standalone: true,
  imports: [
    CommonModule,
    TablerIconsModule,
    TranslateModule,
    DashboardSubHeaderComponent,
    CardsUnitsComponent
  ],
  templateUrl: './all-units.component.html',
  styleUrl: './all-units.component.scss'
})
export class AllUnitsComponent {
  private unitsService = inject(UnitsService);
  private cdr          = inject(ChangeDetectorRef);
  private translate    = inject(TranslateService);

  activeTab: string = 'new';
  searchQuery       = '';
  viewMode: ViewMode = 'grid';
  buildingsWithUnits: BuildingWithUnits[] = [];
  isLoading    = false;
  totalCount   = 0;
  totalPages   = 1;
  currentPage  = 1;

  metrics: MetricCard[] = [
    { titleKey: 'd3.allUnits.cards.publishedUnits',   value: '—', icon: 'building',     tone: 'black'  },
    { titleKey: 'd3.allUnits.cards.activeUnits',      value: '—', icon: 'circle-check', tone: 'green'  },
    { titleKey: 'd3.allUnits.cards.stoppedUnits',     value: '—', icon: 'player-pause', tone: 'gray'   },
    { titleKey: 'd3.allUnits.cards.underReviewUnits', value: '—', icon: 'clock-hour-3', tone: 'orange' }
  ];

  tabs: TabOption[] = [
    { id: 'published',   labelKey: 'd3.allUnits.tabs.published'   },
    { id: 'new',         labelKey: 'd3.allUnits.tabs.new'         },
    { id: 'underReview', labelKey: 'd3.allUnits.tabs.underReview' },
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
      items: [{ value: 'newest', labelKey: 'd3.allUnits.filters.sortNewest' }]
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
      this.updateMetrics(this.unitsService.filterUnits());
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

  private updateMetrics(units: UnitApiItem[]): void {
    const publishedPropertyIds = new Set(
      units
        .filter(unit => unit.propertyAdminReviewStatus === 'Approved')
        .map(unit => unit.propertyId)
    );
    const activeUnits = units.filter(unit => unit.reviewStatus === 'Approved').length;
    const stoppedUnits = units.filter(unit => unit.reviewStatus === 'Rejected').length;
    const underReviewUnits = units.filter(unit =>
      unit.reviewStatus === 'Pending' || unit.reviewStatus === 'UnderReview'
    ).length;

    this.metrics = [
      { ...this.metrics[0], value: this.formatNumber(publishedPropertyIds.size) },
      { ...this.metrics[1], value: this.formatNumber(activeUnits) },
      { ...this.metrics[2], value: this.formatNumber(stoppedUnits) },
      { ...this.metrics[3], value: this.formatNumber(underReviewUnits) }
    ];
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
    return this.activeTab === 'new' || this.activeTab === 'underReview';
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
    this.unitsService.setAccountFilter(accountId);
    this.unitsService.setPropertyFilter(propertyId);
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.unitsService.goToBuildingPage(page);
  }
}
