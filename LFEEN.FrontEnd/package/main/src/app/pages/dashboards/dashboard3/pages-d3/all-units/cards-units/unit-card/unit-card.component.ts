import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UnitCardItem } from '../../../../interfaces/unit-card.model';
import { ViewMode } from '../../../../interfaces/dashboard-sub-header.model';

@Component({
  selector: 'app-unit-card',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './unit-card.component.html',
  styleUrl: './unit-card.component.scss'
})
export class UnitCardComponent {
  @Input() unit!: UnitCardItem;
  @Input() viewMode: ViewMode = 'grid';
  @Input() buildingId = '';

  constructor(
    private translate: TranslateService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  goToReview(): void {
    this.router.navigate(
      ['../unit-review', this.buildingId, this.unit.id],
      { relativeTo: this.route, queryParams: { mode: 'view' } }
    );
  }
}
