import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { BuildingCardItem, BuildingViewMode } from '../building-card.model';

@Component({
  selector: 'app-cards-builds',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './cards-builds.component.html',
  styleUrl: './cards-builds.component.scss'
})
export class CardsBuildsComponent {
  @Input() buildings: BuildingCardItem[] = [];
  @Input() viewMode: BuildingViewMode = 'grid';

  occupancyTone(occupancy: number, status: BuildingCardItem['status']): 'high' | 'medium' | 'low' | 'stopped' {
    if (status === 'stopped' || occupancy === 0) {
      return 'stopped';
    }
    if (occupancy >= 75) {
      return 'high';
    }
    if (occupancy >= 50) {
      return 'medium';
    }
    return 'low';
  }
}
