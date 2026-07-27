import { CommonModule } from '@angular/common';
import { Component, inject, effect, ChangeDetectorRef, OnInit } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BuildingCardItem, BuildingTab } from '../../interfaces/building-card.model';
import { CardsBuildsComponent } from './cards-builds/cards-builds.component';
import { DashboardSubHeaderComponent } from 'src/app/components/dashboard3/dashboard-sub-header/dashboard-sub-header.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { MetricCard, TabOption, ViewMode, BuildFilterOption } from '../../interfaces/dashboard-sub-header.model';
import { BuildingReviewService } from '../../services/building-review.service';
import { MaterialModule } from 'src/app/material.module';
import { forkJoin } from 'rxjs';
import { formatNumber, getVisiblePages } from 'src/app/utils/pagination.util';

@Component({
  selector: 'app-all-builds',
  standalone: true,
  imports: [
    CommonModule,
    TablerIconsModule,
    TranslateModule,
    MaterialModule,
    DashboardSubHeaderComponent,
    DashboardLoadingComponent,
    CardsBuildsComponent
  ],
  templateUrl: './all-builds.component.html',
  styleUrl: './all-builds.component.scss'
})
export class AllBuildsComponent implements OnInit {
  private buildingService = inject(BuildingReviewService);
  private cdr             = inject(ChangeDetectorRef);
  private translate       = inject(TranslateService);

  activeTab: string          = this.buildingService.activeTab();
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
    { titleKey: 'd3.allBuilds.cards.totalBuildings',        value: '—', icon: 'building',     tone: 'black'  },
    { titleKey: 'd3.allBuilds.cards.activeBuildings',      value: '—', icon: 'circle-check', tone: 'green'  },
    { titleKey: 'd3.allBuilds.cards.inactiveBuildings',    value: '—', icon: 'player-pause', tone: 'gray'   },
    { titleKey: 'd3.allBuilds.cards.unpublishedBuildings', value: '—', icon: 'clock-hour-3', tone: 'orange' }
  ];

  tabs: TabOption[] = [
    { id: 'draft',       labelKey: 'd3.allBuilds.tabs.draft'       },
    { id: 'published',   labelKey: 'd3.allBuilds.tabs.published'   },
    { id: 'new',         labelKey: 'd3.allBuilds.tabs.new'         },
    { id: 'underReview', labelKey: 'd3.allBuilds.tabs.underReview' },
    { id: 'pendingChanges', labelKey: 'd3.allBuilds.tabs.pendingChanges' },
    { id: 'rejected',    labelKey: 'd3.allBuilds.tabs.rejected'    }
  ];

  filterOptions: BuildFilterOption[] = [
    {
      id: 'status',
      labelKey: 'd3.allBuilds.filters.allStatuses',
      items: [
        { value: 'all',            labelKey: 'd3.allBuilds.filters.options.all'  },
        { value: 'draft',          labelKey: 'd3.allBuilds.tabs.draft'           },
        { value: 'published',      labelKey: 'd3.allBuilds.tabs.published'       },
        { value: 'new',            labelKey: 'd3.allBuilds.tabs.new'             },
        { value: 'underReview',    labelKey: 'd3.allBuilds.tabs.underReview'     },
        { value: 'pendingChanges', labelKey: 'd3.allBuilds.tabs.pendingChanges'  },
        { value: 'rejected',       labelKey: 'd3.allBuilds.tabs.rejected'        }
      ]
    },
    {
      id: 'city',
      labelKey: 'd3.allBuilds.filters.allCities',
      items: [
        { value: 'all', labelKey: 'd3.allBuilds.filters.options.all' }
      ]
    },
    {
      id: 'type',
      labelKey: 'd3.allBuilds.filters.allTypes',
      items: [
        { value: 'all', labelKey: 'd3.allBuilds.filters.options.all' }
      ]
    },
    {
      id: 'sort',
      labelKey: 'd3.allBuilds.filters.newest',
      items: [
        { value: 'newest',    labelKey: 'd3.allBuilds.filters.newest'               },
        { value: 'oldest',    labelKey: 'd3.allBuilds.filters.options.oldest'        },
        { value: 'occupancy', labelKey: 'd3.allBuilds.filters.options.occupancyHigh' }
      ]
    }
  ];

  searchPlaceholder = 'd3.allBuilds.filters.searchPlaceholder';

  constructor() {
    effect(() => {
      this.activeTab   = this.buildingService.activeTab();
      this.allBuildings = this.buildingService.buildings();
      this.isLoading    = this.buildingService.isLoading();
      this.totalPages   = this.buildingService.totalPages();
      this.currentPage  = this.buildingService.currentPage();
      this.totalCount   = this.buildingService.totalCount();
      this.pageNumbers  = Array.from({ length: this.totalPages }, (_, i) => i + 1);

      const s = this.buildingService.propertyStats();
      if (s) {
        this.metrics = [
          { ...this.metrics[0], value: formatNumber(s.total)              },
          { ...this.metrics[1], value: formatNumber(s.activeOrPublished)  },
          { ...this.metrics[2], value: formatNumber(s.underReview)        },
          { ...this.metrics[3], value: formatNumber(s.pendingOrRejected)  },
        ];
      }

      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.loadFilterOptions();
  }

  private loadFilterOptions(): void {
    forkJoin({
      cities: this.buildingService.getCities(),
      types:  this.buildingService.getPropertyTypes()
    }).subscribe({
      next: ({ cities, types }) => {
        this.filterOptions = this.filterOptions.map(filter => {
          if (filter.id === 'city') {
            return {
              ...filter,
              items: [
                { value: 'all', labelKey: 'd3.allBuilds.filters.options.all' },
                ...cities.map(city => ({ value: city, labelKey: city }))
              ]
            };
          }
          if (filter.id === 'type') {
            return {
              ...filter,
              items: [
                { value: 'all', labelKey: 'd3.allBuilds.filters.options.all' },
                ...types.map(t => ({ value: String(t.id), labelKey: t.name }))
              ]
            };
          }
          return filter;
        });
        this.cdr.markForCheck();
      }
    });
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  get filteredBuildings(): BuildingCardItem[] {
    let buildings = this.allBuildings;

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

  private readonly statusFilterTabs: BuildingTab[] =
    ['draft', 'published', 'new', 'underReview', 'pendingChanges', 'rejected'];

  onFiltersChange(filters: Record<string, string>): void {
    this.selectedFilters = filters;

    const statusValue = filters['status'];
    if (this.statusFilterTabs.includes(statusValue as BuildingTab) && statusValue !== this.activeTab) {
      this.onTabChange(statusValue);
    }

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
