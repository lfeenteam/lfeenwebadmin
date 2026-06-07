import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { BuildingCardItem, BuildingViewMode } from '../../../interfaces/building-card.model';
import { BulidingCardsComponent } from './buliding-cards/buliding-cards.component';
import { ReviewCardsComponent } from './review-cards/review-cards.component';


@Component({
  selector: 'app-cards-builds',
  standalone: true,
  imports: [
    CommonModule,
    TablerIconsModule,
    TranslateModule,
    BulidingCardsComponent,
    ReviewCardsComponent
  ],
  templateUrl: './cards-builds.component.html',
  styleUrl: './cards-builds.component.scss'
})
export class CardsBuildsComponent {
  @Input() buildings: BuildingCardItem[] = [];
  @Input() viewMode: BuildingViewMode = 'grid';
  @Input() activeTab: string = 'published';

  occupancyTone(occupancy: number, status: string): string {
    if (status === 'stopped') return 'stopped';
    if (occupancy >= 75) return 'high';
    if (occupancy >= 50) return 'medium';
    return 'low';
  }

  get isReviewTab(): boolean {
    return this.activeTab === 'underReview';
  }

  get hasUnderReview(): boolean {
    return this.buildings.some(b => b.tab === 'underReview');
  }
}