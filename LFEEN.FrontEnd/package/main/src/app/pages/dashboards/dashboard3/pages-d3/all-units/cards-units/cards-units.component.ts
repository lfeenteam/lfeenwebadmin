import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BuildingWithUnits } from '../../../interfaces/unit-card.model';
import { ViewMode } from '../../../interfaces/dashboard-sub-header.model';
import { UnitCardComponent } from './unit-card/unit-card.component';
import { UnitCardReviewComponent } from './unit-card-review/unit-card-review.component';

@Component({
  selector: 'app-cards-units',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, UnitCardComponent, UnitCardReviewComponent],
  templateUrl: './cards-units.component.html',
  styleUrl: './cards-units.component.scss'
})
export class CardsUnitsComponent {
  @Input() buildings: BuildingWithUnits[] = [];
  @Input() isReviewTab: boolean = false;
  @Input() viewMode: ViewMode = 'grid';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private translate: TranslateService
  ) {}

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  goToBuildReview(buildingId: string): void {
    this.router.navigate(['../build-review', buildingId], { relativeTo: this.route });
  }
}
