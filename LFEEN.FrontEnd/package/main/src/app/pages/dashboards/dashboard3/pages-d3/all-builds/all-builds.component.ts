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
import { BuildingReviewService } from './building-review.service';
import { Subscription } from 'rxjs';

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
  allBuildings: BuildingCardItem[] = [];
  private sub = new Subscription();

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

  setViewMode(mode: BuildingViewMode): void {
    this.viewMode = mode;
  }
}
