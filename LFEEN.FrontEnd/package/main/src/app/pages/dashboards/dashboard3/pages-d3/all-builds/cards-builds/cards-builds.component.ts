import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { BuildingCardItem, BuildingViewMode } from '../../../interfaces/building-card.model';
import { BulidingCardsComponent } from './buliding-cards/buliding-cards.component';
import { ReviewCardsComponent } from './review-cards/review-cards.component';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { BannedListingCardComponent } from 'src/app/components/dashboard3/ban-listing/banned-listing-card/banned-listing-card.component';
import { BuildingReviewService } from '../../../services/building-review.service';


@Component({
  selector: 'app-cards-builds',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    BulidingCardsComponent,
    ReviewCardsComponent,
    DashboardEmptyComponent,
    BannedListingCardComponent
  ],
  templateUrl: './cards-builds.component.html',
  styleUrl: './cards-builds.component.scss'
})
export class CardsBuildsComponent {
  @Input() buildings: BuildingCardItem[] = [];
  @Input() viewMode: BuildingViewMode = 'grid';
  @Input() activeTab: string = 'published';

  private buildingService = inject(BuildingReviewService);

  onBanChanged(): void {
    this.buildingService.reload();
  }

  get emptyTitleKey(): string {
    return `d3.emptyState.builds.${this.activeTab}.title`;
  }

  get emptyDescKey(): string {
    return `d3.emptyState.builds.${this.activeTab}.desc`;
  }

  occupancyTone(occupancy: number, status: string): string {
    if (status === 'stopped') return 'stopped';
    if (occupancy >= 75) return 'high';
    if (occupancy >= 50) return 'medium';
    return 'low';
  }

  get isReviewTab(): boolean {
    return this.activeTab === 'underReview' || this.activeTab === 'pendingChanges';
  }

  get hasUnderReview(): boolean {
    return this.buildings.some(b => b.tab === 'underReview');
  }
}
