import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { DashboardSubHeaderComponent } from 'src/app/components/dashboard3/dashboard-sub-header/dashboard-sub-header.component';
import { MetricCard, TabOption, ViewMode, BuildFilterOption } from 'src/app/components/dashboard3/dashboard-sub-header/dashboard-sub-header.model';
import { UnitsService } from './units.service';
import { BuildingWithUnits } from './unit-card.model';
import { Subscription } from 'rxjs';
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
  activeTab: string = 'published';
  searchQuery = '';
  viewMode: ViewMode = 'grid';
  buildingsWithUnits: BuildingWithUnits[] = [];
  private sub = new Subscription();

  metrics: MetricCard[] = [
    {
      titleKey: 'd3.allUnits.cards.publishedUnits',
      value: '1,843',
      icon: 'building',
      tone: 'black'
    },
    {
      titleKey: 'd3.allUnits.cards.activeUnits',
      value: '34,500',
      icon: 'circle-check',
      tone: 'green'
    },
    {
      titleKey: 'd3.allUnits.cards.stoppedUnits',
      value: '1,410',
      icon: 'player-pause',
      tone: 'gray'
    },
    {
      titleKey: 'd3.allUnits.cards.underReviewUnits',
      value: '450',
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
      id: 'property',
      labelKey: 'd3.allUnits.filters.allProperties',
      items: [
        { value: 'all', labelKey: 'd3.allUnits.filters.allProperties' }
      ]
    },
    {
      id: 'status',
      labelKey: 'd3.allUnits.filters.allStatuses',
      items: [
        { value: 'all', labelKey: 'd3.allUnits.filters.allStatuses' }
      ]
    },
    {
      id: 'unitType',
      labelKey: 'd3.allUnits.filters.unitType',
      items: [
        { value: 'all', labelKey: 'd3.allUnits.filters.unitType' }
      ]
    },
    {
      id: 'sort',
      labelKey: 'd3.allUnits.filters.sortNewest',
      items: [
        { value: 'newest', labelKey: 'd3.allUnits.filters.sortNewest' }
      ]
    }
  ];

  searchPlaceholder = 'd3.allUnits.filters.searchPlaceholder';

  constructor(private unitsService: UnitsService) {}

  ngOnInit(): void {
    this.sub.add(
      this.unitsService.getBuildingsWithUnits().subscribe(data => {
        this.buildingsWithUnits = data;
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
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

  get filteredUnitsData(): BuildingWithUnits[] {
    const query = this.searchQuery.trim().toLowerCase();
    
    return this.buildingsWithUnits.map(building => {
      // If it's the underReview tab and building needs property review, we keep it even if units are empty
      if (this.activeTab === 'underReview' && building.needsPropertyReview) {
        return building;
      }

      const filteredUnits = building.units.filter(unit => {
        // Filter by tab
        let matchesTab = false;
        if (this.activeTab === 'underReview') {
          // In underReview tab, we show units that are underReview OR stopped units of a building that needs review
          matchesTab = unit.status === 'underReview' || (!!building.needsPropertyReview && unit.status === 'stopped');
        } else {
          // In published tab, we show active and stopped units (but maybe not the ones in buildings needing review)
          matchesTab = unit.status === 'active' || (!building.needsPropertyReview && unit.status === 'stopped');
        }
        
        if (!matchesTab) return false;

        // Filter by search query
        return !query || 
          unit.title.toLowerCase().includes(query) || 
          unit.unitNumber.toLowerCase().includes(query);
      });

      return {
        ...building,
        units: filteredUnits
      };
    }).filter(building => building.units.length > 0 || (this.activeTab === 'underReview' && building.needsPropertyReview));
  }
}
