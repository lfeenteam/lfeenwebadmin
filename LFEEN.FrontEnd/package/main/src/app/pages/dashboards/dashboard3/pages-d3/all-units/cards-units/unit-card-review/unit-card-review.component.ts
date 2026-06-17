import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UnitCardItem } from '../../../../interfaces/unit-card.model';

@Component({
  selector: 'app-unit-card-review',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './unit-card-review.component.html',
  styleUrl: './unit-card-review.component.scss'
})
export class UnitCardReviewComponent {
  @Input() unit!: UnitCardItem;
  @Input() forceUnderReviewStyle: boolean = false;
  @Input() buildingId!: string;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private translate: TranslateService
  ) {}

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get isLockedDisplay(): boolean {
    return this.unit.status === 'stopped' && !this.forceUnderReviewStyle;
  }

  goToReview(): void {
    this.router.navigate(['../unit-review', this.buildingId, this.unit.id], {
      relativeTo: this.route
    });
  }
}
