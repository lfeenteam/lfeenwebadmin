import { Component, Input } from '@angular/core';
import { BuildingCardItem, BuildingViewMode } from '../../../../interfaces/building-card.model';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-buliding-cards',
   imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './buliding-cards.component.html',
  styleUrl: './buliding-cards.component.scss'
})
export class BulidingCardsComponent {
  @Input() building!: BuildingCardItem;
  @Input() viewMode: BuildingViewMode = 'grid';

  imageError = false;

  occupancyTone(occupancy: number, status: string): string {
    if (status === 'stopped') return 'stopped';
    if (occupancy >= 75) return 'high';
    if (occupancy >= 50) return 'medium';
    return 'low';
  }

  get initials(): string {
    return this.building.title.trim().slice(0, 2).toUpperCase();
  }

  onImageError(): void {
    this.imageError = true;
  }
}
