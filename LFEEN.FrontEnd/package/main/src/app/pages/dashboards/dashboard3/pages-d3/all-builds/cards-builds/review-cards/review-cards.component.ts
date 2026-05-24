import { Component, Input } from '@angular/core';
import { BuildingCardItem, BuildingViewMode } from '../../building-card.model';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-review-cards',
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './review-cards.component.html',
  styleUrl: './review-cards.component.scss'
})
export class ReviewCardsComponent {
  @Input() building!: BuildingCardItem;
  @Input() viewMode: BuildingViewMode = 'grid';
}
