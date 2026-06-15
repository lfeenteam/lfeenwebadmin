import { Component, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BuildingCardItem, BuildingViewMode } from '../../../../interfaces/building-card.model';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-review-cards',
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './review-cards.component.html',
  styleUrl: './review-cards.component.scss'
})
export class ReviewCardsComponent {
  @Input() building!: BuildingCardItem;
  @Input() viewMode: BuildingViewMode = 'grid';

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
}
