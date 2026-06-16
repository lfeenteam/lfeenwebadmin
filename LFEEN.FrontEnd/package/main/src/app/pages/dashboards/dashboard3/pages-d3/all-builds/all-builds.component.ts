import { CommonModule } from '@angular/common';
import { Component, inject, effect, ChangeDetectorRef, DestroyRef, OnInit } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BuildingCardItem, BuildingTab } from '../../interfaces/building-card.model';
import { CardsBuildsComponent } from './cards-builds/cards-builds.component';
import { DashboardSubHeaderComponent } from 'src/app/components/dashboard3/dashboard-sub-header/dashboard-sub-header.component';
import { MetricCard, TabOption, ViewMode, BuildFilterOption } from '../../interfaces/dashboard-sub-header.model';
import { BuildingReviewService } from '../../services/building-review.service';
import { MaterialModule } from 'src/app/material.module';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-all-builds',
  standalone: true,
  imports: [
    CommonModule,
    TablerIconsModule,
    TranslateModule,
    MaterialModule,
    DashboardSubHeaderComponent,
    CardsBuildsComponent
  ],
  templateUrl: './all-builds.component.html',
  styleUrl: './all-builds.component.scss'
})
export class AllBuildsComponent implements OnInit {
  private buildingService = inject(BuildingReviewService);
  private cdr             = inject(ChangeDetectorRef);
  private translate       = inject(TranslateService);
  private destroyRef      = inject(DestroyRef);

  activeTab: string          = 'published';
  searchQuery                = '';
  selectedFilters: Record<string, string> = {
    status: 'all',
    city: 'all',
    type: 'all',
    sort: 'newest'
  };
  viewMode: ViewMode         = 'grid';
  allBuildings: BuildingCardItem[] = [];
  isLoading                  = false;
  totalPages                 = 1;
  currentPage                = 1;
  totalCount                 = 0;
  pageNumbers: number[]      = [];

  metrics: MetricCard[] = [
    { titleKey: 'd3.allBuilds.cards.buildingsAvailable', value: '—', icon: 'circle-check', tone: 'green'  },
    { titleKey: 'd3.allBuilds.cards.activeBuildings',    value: '—', icon: 'player-pause', tone: 'gray'   },
    { titleKey: 'd3.allBuilds.cards.totalUnits',         value: '—', icon: 'building',     tone: 'black'  },
    { titleKey: 'd3.allBuilds.cards.monthlyUnits',       value: '—', icon: 'clock-hour-3', tone: 'orange' }
  ];

  tabs: TabOption[] = [
    { id: 'published',   labelKey: 'd3.allBuilds.tabs.published'   },
    { id: 'new',         labelKey: 'd3.allBuilds.tabs.new'         },
    { id: 'underReview', labelKey: 'd3.allBuilds.tabs.underReview' },
    { id: 'rejected',    labelKey: 'd3.allBuilds.tabs.rejected'    }
  ];

  filterOptions: BuildFilterOption[] = [
    {
      id: 'status',
      labelKey: 'd3.allBuilds.filters.allStatuses',
      items: [
        { value: 'all',     labelKey: 'd3.allBuilds.filters.options.all'       },
        { value: 'active',  labelKey: 'd3.allBuilds.buildingCard.statusActive'  },
        { value: 'stopped', labelKey: 'd3.allBuilds.buildingCard.statusStopped' }
      ]
    },
    {
      id: 'city',
      labelKey: 'd3.allBuilds.filters.allCities',
      items: [
        { value: 'all',     labelKey: 'd3.allBuilds.filters.options.all'    },
        { value: 'الرياض',  labelKey: 'd3.allBuilds.filters.options.riyadh' },
        { value: 'جدة',     labelKey: 'd3.allBuilds.filters.options.jeddah' },
        { value: 'الدمام',  labelKey: 'd3.allBuilds.filters.options.dammam' }
      ]
    },
    {
      id: 'type',
      labelKey: 'd3.allBuilds.filters.allTypes',
      items: [
        { value: 'all',        labelKey: 'd3.allBuilds.filters.options.all'        },
        { value: 'Hotel',          labelKey: 'd3.allBuilds.filters.options.hotel'       },
        { value: 'HotelAppartments', labelKey: 'd3.allBuilds.filters.options.apartments' },
        { value: 'Villa',          labelKey: 'd3.allBuilds.filters.options.villas'      }
      ]
    },
    {
      id: 'sort',
      labelKey: 'd3.allBuilds.filters.newest',
      items: [
        { value: 'newest',    labelKey: 'd3.allBuilds.filters.newest'                 },
        { value: 'oldest',    labelKey: 'd3.allBuilds.filters.options.oldest'          },
        { value: 'occupancy', labelKey: 'd3.allBuilds.filters.options.occupancyHigh'   }
      ]
    }
  ];

  searchPlaceholder = 'd3.allBuilds.filters.searchPlaceholder';

  constructor() {
    effect(() => {
      this.allBuildings = this.buildingService.buildings();
      this.isLoading    = this.buildingService.isLoading();
      this.totalPages   = this.buildingService.totalPages();
      this.currentPage  = this.buildingService.currentPage();
      this.totalCount   = this.buildingService.totalCount();
      this.pageNumbers  = Array.from({ length: this.totalPages }, (_, i) => i + 1);
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadStatistics());

    this.loadStatistics();
  }

  private loadStatistics(): void {
    this.buildingService.getPropertyStatistics().subscribe({
      next: stats => {
        this.metrics = [
          { ...this.metrics[0], value: this.formatNumber(stats.totalProperties) },
          { ...this.metrics[1], value: this.formatNumber(stats.activeProperties) },
          { ...this.metrics[2], value: this.formatNumber(stats.totalUnits) },
          { ...this.metrics[3], value: this.formatNumber(stats.underReviewProperties) }
        ];
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck()
    });
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat().format(value);
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): (number | '...')[] {
    const n = this.totalPages;
    const c = this.currentPage;

    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);

    if (c <= 4)     return [1, 2, 3, 4, '...', n - 2, n - 1, n];
    if (c >= n - 3) return [1, 2, 3, '...', n - 3, n - 2, n - 1, n];

    return [1, 2, 3, '...', c, '...', n - 2, n - 1, n];
  }

  get filteredBuildings(): BuildingCardItem[] {
    let buildings = this.allBuildings;
    const activityStatus = this.selectedFilters['status'];

    if (activityStatus === 'active') {
      buildings = buildings.filter(building => building.status === 'active');
    } else if (activityStatus === 'stopped') {
      buildings = buildings.filter(building => building.status === 'stopped');
    }

    if (this.selectedFilters['sort'] === 'occupancy') {
      buildings = [...buildings].sort((a, b) => b.occupancy - a.occupancy);
    }

    return buildings;
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
    this.buildingService.setTab(tab as BuildingTab);
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    this.buildingService.setSearch(query);
  }

  onFiltersChange(filters: Record<string, string>): void {
    this.selectedFilters = filters;
    this.buildingService.setFilters({
      city: filters['city'] === 'all' ? '' : filters['city'],
      propertyTypeId: filters['type'] === 'all' ? '' : filters['type'],
      newestFirst: filters['sort'] !== 'oldest'
    });
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.buildingService.goToPage(page);
  }
}
