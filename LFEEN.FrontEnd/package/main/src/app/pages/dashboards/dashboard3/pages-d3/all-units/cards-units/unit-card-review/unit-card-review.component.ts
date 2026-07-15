import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UnitCardItem } from '../../../../interfaces/unit-card.model';
import { ViewMode } from '../../../../interfaces/dashboard-sub-header.model';

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
  @Input() viewMode: ViewMode = 'grid';

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

  get badgeConfig(): { labelKey: string; mod: string } {
    switch (this.unit.status) {
      case 'active':         return { labelKey: 'd3.allUnits.unitCard.statusApproved',      mod: 'active'         };
      case 'draft':           return { labelKey: 'd3.allUnits.unitCard.statusDraft',         mod: 'draft'          };
      case 'stopped':        return { labelKey: 'd3.allUnits.unitCard.statusStopped',        mod: 'stopped'        };
      case 'pending':        return { labelKey: 'd3.allUnits.unitCard.statusPending',        mod: 'pending'        };
      case 'underReview':    return { labelKey: 'd3.allUnits.unitCard.statusUnderReview',    mod: 'underReview'    };
      case 'pendingChanges': return { labelKey: 'd3.allUnits.unitCard.statusPendingChanges', mod: 'pendingChanges' };
      case 'pendingAfterRejection': return { labelKey: 'd3.allUnits.unitCard.statusPendingAfterRejection', mod: 'pendingAfterRejection' };
    }
  }

  get servicesPricingKey(): string {
    return this.unit.servicesPricingType === 'free'
      ? 'd3.allUnits.unitCard.servicesFree'
      : 'd3.allUnits.unitCard.servicesPaid';
  }

  get isFreeServices(): boolean {
    return this.unit.servicesPricingType === 'free';
  }

  goToReview(): void {
    this.router.navigate(['../unit-review', this.buildingId, this.unit.id], {
      relativeTo: this.route
    });
  }
}
