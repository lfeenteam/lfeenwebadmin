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
import { TabsFilterComponent } from './tabs-filter/tabs-filter.component';

interface BuildingMetricCard {
  titleKey: string;
  value: string;
  icon: string;
  tone: 'green' | 'gray' | 'black' | 'orange';
}

@Component({
  selector: 'app-all-builds',
  standalone: true,
  imports: [
    CommonModule,
    TablerIconsModule,
    TranslateModule,
    TabsFilterComponent,
    CardsBuildsComponent
  ],
  templateUrl: './all-builds.component.html',
  styleUrl: './all-builds.component.scss'
})
export class AllBuildsComponent {
  activeTab: BuildingTab = 'published';
  searchQuery = '';
  viewMode: BuildingViewMode = 'grid';

  cards: BuildingMetricCard[] = [
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

  private readonly allBuildings: BuildingCardItem[] = [
    {
      id: '1',
      title: 'd3.allBuilds.buildingNames.building1',
      host: 'd3.allBuilds.buildingHosts.host1',
      location: 'd3.allBuilds.buildingLocations.location1',
      status: 'active',
      typeLabel: 'd3.allBuilds.buildings.hotel',
      units: 120,
      occupancy: 85,
      bookings: 42,
      lastUpdate: 'd3.allBuilds.buildingDates.date1',
      tab: 'published'
    },
    {
      id: '2',
      title: 'd3.allBuilds.buildingNames.building2',
      host: 'd3.allBuilds.buildingHosts.host2',
      location: 'd3.allBuilds.buildingLocations.location2',
      status: 'active',
      typeLabel: 'd3.allBuilds.buildings.apartments',
      units: 45,
      occupancy: 63,
      bookings: 18,
      lastUpdate: 'd3.allBuilds.buildingDates.date2',
      tab: 'published'
    },
    {
      id: '3',
      title: 'd3.allBuilds.buildingNames.building3',
      host: 'd3.allBuilds.buildingHosts.host3',
      location: 'd3.allBuilds.buildingLocations.location3',
      status: 'stopped',
      typeLabel: 'd3.allBuilds.buildings.compounds',
      units: 18,
      occupancy: 0,
      bookings: 0,
      lastUpdate: 'd3.allBuilds.buildingDates.date3',
      tab: 'published'
    },
    {
      id: '4',
      title: 'd3.allBuilds.buildingNames.building4',
      host: 'd3.allBuilds.buildingHosts.host4',
      location: 'd3.allBuilds.buildingLocations.location4',
      status: 'active',
      typeLabel: 'd3.allBuilds.buildings.chalets',
      units: 12,
      occupancy: 92,
      bookings: 8,
      lastUpdate: 'd3.allBuilds.buildingDates.date4',
      tab: 'published'
    },
    {
      id: '5',
      title: 'd3.allBuilds.buildingNames.building5',
      host: 'd3.allBuilds.buildingHosts.host5',
      location: 'd3.allBuilds.buildingLocations.location5',
      status: 'active',
      typeLabel: 'd3.allBuilds.buildings.villas',
      units: 8,
      occupancy: 62,
      bookings: 3,
      lastUpdate: 'd3.allBuilds.buildingDates.date5',
      tab: 'published'
    },
    {
      id: '6',
      title: 'd3.allBuilds.buildingNames.building6',
      host: 'd3.allBuilds.buildingHosts.host6',
      location: 'd3.allBuilds.buildingLocations.location6',
      status: 'active',
      typeLabel: 'd3.allBuilds.buildings.rests',
      units: 15,
      occupancy: 45,
      bookings: 12,
      lastUpdate: 'd3.allBuilds.buildingDates.date6',
      tab: 'published'
    },
    {
      id: '7',
      title: 'd3.allBuilds.buildingNames.building7',
      host: 'd3.allBuilds.buildingHosts.host7',
      location: 'd3.allBuilds.buildingLocations.location7',
      status: 'active',
      typeLabel: 'd3.allBuilds.buildings.compounds',
      units: 80,
      occupancy: 68,
      bookings: 22,
      lastUpdate: 'd3.allBuilds.buildingDates.date7',
      tab: 'underReview'
    },
    {
      id: '8',
      title: 'd3.allBuilds.buildingNames.building8',
      host: 'd3.allBuilds.buildingHosts.host8',
      location: 'd3.allBuilds.buildingLocations.location8',
      status: 'active',
      typeLabel: 'd3.allBuilds.buildings.hotel',
      units: 95,
      occupancy: 55,
      bookings: 31,
      lastUpdate: 'd3.allBuilds.buildingDates.date8',
      tab: 'underReview'
    }
  ];

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

  setViewMode(mode: BuildingViewMode): void {
    this.viewMode = mode;
  }
}
