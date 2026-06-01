import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import {
  BuildingCardItem,
  BuildingTab,
  BuildingViewMode
} from './building-card.model';
import { CardsBuildsComponent } from './cards-builds/cards-builds.component';
import { DashboardSubHeaderComponent } from 'src/app/components/dashboard3/dashboard-sub-header/dashboard-sub-header.component';
import { MetricCard, TabOption, ViewMode, BuildFilterOption } from 'src/app/components/dashboard3/dashboard-sub-header/dashboard-sub-header.model';
import { BuildingReviewService } from './building-review.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-all-builds',
  standalone: true,
  imports: [
    CommonModule,
    TablerIconsModule,
    TranslateModule,
    DashboardSubHeaderComponent,
    CardsBuildsComponent
  ],
  templateUrl: './all-builds.component.html',
  styleUrl: './all-builds.component.scss'
})
export class AllBuildsComponent {
  activeTab: string = 'published';
  searchQuery = '';
  viewMode: ViewMode = 'grid';
  allBuildings: BuildingCardItem[] = [];
  private sub = new Subscription();

  metrics: MetricCard[] = [
    {
      titleKey: 'd3.allBuilds.cards.buildingsAvailable',
      value: '1,10',
      icon: 'circle-check',
      tone: 'green'
    },
    {
      titleKey: 'd3.allBuilds.cards.activeBuildings',
      value: '192',
      icon: 'player-pause',
      tone: 'gray'
    },
    {
      titleKey: 'd3.allBuilds.cards.totalUnits',
      value: '25,910',
      icon: 'building',
      tone: 'black'
    },
    {
      titleKey: 'd3.allBuilds.cards.monthlyUnits',
      value: '14',
      icon: 'clock-hour-3',
      tone: 'orange'
    }
  ];

  tabs: TabOption[] = [
    { id: 'published', labelKey: 'd3.allBuilds.tabs.published' },
    { id: 'underReview', labelKey: 'd3.allBuilds.tabs.underReview' }
  ];

  filterOptions: BuildFilterOption[] = [
    {
      id: 'status',
      labelKey: 'd3.allBuilds.filters.allStatuses',
      items: [
        { value: 'all', labelKey: 'd3.allBuilds.filters.options.all' },
        { value: 'active', labelKey: 'd3.allBuilds.buildingCard.statusActive' },
        { value: 'stopped', labelKey: 'd3.allBuilds.buildingCard.statusStopped' }
      ]
    },
    {
      id: 'city',
      labelKey: 'd3.allBuilds.filters.allCities',
      items: [
        { value: 'all', labelKey: 'd3.allBuilds.filters.options.all' },
        { value: 'riyadh', labelKey: 'd3.allBuilds.filters.options.riyadh' },
        { value: 'jeddah', labelKey: 'd3.allBuilds.filters.options.jeddah' },
        { value: 'dammam', labelKey: 'd3.allBuilds.filters.options.dammam' }
      ]
    },
    {
      id: 'type',
      labelKey: 'd3.allBuilds.filters.allTypes',
      items: [
        { value: 'all', labelKey: 'd3.allBuilds.filters.options.all' },
        { value: 'hotel', labelKey: 'd3.allBuilds.filters.options.hotel' },
        { value: 'apartments', labelKey: 'd3.allBuilds.filters.options.apartments' },
        { value: 'villas', labelKey: 'd3.allBuilds.filters.options.villas' }
      ]
    },
    {
      id: 'sort',
      labelKey: 'd3.allBuilds.filters.newest',
      items: [
        { value: 'newest', labelKey: 'd3.allBuilds.filters.newest' },
        { value: 'oldest', labelKey: 'd3.allBuilds.filters.options.oldest' },
        { value: 'occupancy', labelKey: 'd3.allBuilds.filters.options.occupancyHigh' }
      ]
    }
  ];

  searchPlaceholder = 'd3.allBuilds.filters.searchPlaceholder';

  constructor(private buildingService: BuildingReviewService) {}

  ngOnInit(): void {
    this.sub.add(
      this.buildingService.getBuildings().subscribe(builds => {
        this.allBuildings = builds;
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  get filteredBuildings(): BuildingCardItem[] {
    const query = this.searchQuery.trim().toLowerCase();

    return this.allBuildings.filter((building) => {
      if (building.tab !== this.activeTab) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        building.title.toLowerCase().includes(query) ||
        building.location.toLowerCase().includes(query)
      );
    });
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
  }

  onSearch(query: string): void {
    this.searchQuery = query;
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }
}
