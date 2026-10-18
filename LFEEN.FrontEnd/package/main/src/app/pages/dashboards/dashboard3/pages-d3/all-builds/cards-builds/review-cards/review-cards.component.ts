import { Component, Input, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BuildingCardItem, BuildingViewMode } from '../../../../interfaces/building-card.model';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BanListingButtonComponent } from 'src/app/components/dashboard3/ban-listing/ban-listing-button/ban-listing-button.component';
import { BuildingReviewService } from '../../../../services/building-review.service';

@Component({
  selector: 'app-review-cards',
  imports: [CommonModule, TablerIconsModule, TranslateModule, BanListingButtonComponent],
  templateUrl: './review-cards.component.html',
  styleUrl: './review-cards.component.scss'
})
export class ReviewCardsComponent {
  @Input() building!: BuildingCardItem;
  @Input() viewMode: BuildingViewMode = 'grid';

  private buildingService = inject(BuildingReviewService);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private translate: TranslateService
  ) {}

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  goToBuildReview(): void {
    this.router.navigate(['../build-review', this.building.id], { relativeTo: this.route });
  }

  onBanChanged(): void {
    this.buildingService.reload();
  }
}
