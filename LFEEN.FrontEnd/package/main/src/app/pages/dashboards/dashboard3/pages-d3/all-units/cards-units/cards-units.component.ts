import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BuildingWithUnits } from '../../../interfaces/unit-card.model';
import { ViewMode } from '../../../interfaces/dashboard-sub-header.model';
import { UnitCardComponent } from './unit-card/unit-card.component';
import { UnitCardReviewComponent } from './unit-card-review/unit-card-review.component';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';

@Component({
  selector: 'app-cards-units',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, UnitCardComponent, UnitCardReviewComponent, DashboardEmptyComponent],
  templateUrl: './cards-units.component.html',
  styleUrl: './cards-units.component.scss'
})
export class CardsUnitsComponent {
  @Input() buildings: BuildingWithUnits[] = [];
  @Input() isReviewTab: boolean = false;
  @Input() viewMode: ViewMode = 'grid';
  @Input() activeTab: string = 'published';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private translate: TranslateService
  ) {}

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get emptyTitleKey(): string {
    return `d3.emptyState.units.${this.activeTab}.title`;
  }

  get emptyDescKey(): string {
    return `d3.emptyState.units.${this.activeTab}.desc`;
  }

  goToBuildReview(buildingId: string): void {
    this.router.navigate(['../build-review', buildingId], { relativeTo: this.route });
  }
  getLocationLabel(building: BuildingWithUnits): string {
  const district = building.units.find(u => u.district)?.district;
  return district ?? building.location;
}
}
