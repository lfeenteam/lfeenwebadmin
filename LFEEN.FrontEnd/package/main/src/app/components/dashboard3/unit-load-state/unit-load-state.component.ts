import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MaterialModule } from 'src/app/material.module';
import { ReviewEmptyStateComponent } from '../review-empty-state/review-empty-state.component';
import { LoadFailure } from 'src/app/pages/dashboards/dashboard3/utils/api-error.util';

/**
 * Shown by the unit-review pages instead of their body when the unit couldn't be loaded,
 * so an unknown or deleted unit never renders an empty review with approve/reject buttons.
 * "Not found" leads back to the units list (the unit's own review page is just as missing);
 * any other failure offers a retry.
 */
@Component({
  selector: 'app-unit-load-state',
  standalone: true,
  imports: [TranslateModule, MaterialModule, ReviewEmptyStateComponent],
  template: `
    @if (state === 'notFound') {
      <app-review-empty-state
        icon="home-off"
        titleKey="d3.unitReview.loadState.notFoundTitle"
        descKey="d3.unitReview.loadState.notFoundDescription">
      </app-review-empty-state>
      <div class="state-actions">
        <button mat-stroked-button type="button" (click)="goToUnits()">
          {{ 'd3.unitReview.loadState.backToUnits' | translate }}
        </button>
      </div>
    } @else {
      <app-review-empty-state
        icon="alert-circle"
        titleKey="d3.unitReview.loadState.errorTitle"
        descKey="d3.unitReview.loadState.errorDescription">
      </app-review-empty-state>
      <div class="state-actions">
        <button mat-stroked-button type="button" (click)="goToUnits()">
          {{ 'd3.unitReview.loadState.backToUnits' | translate }}
        </button>
        <button mat-flat-button color="primary" type="button" (click)="retry.emit()">
          {{ 'd3.unitReview.loadState.retry' | translate }}
        </button>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .state-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-top: 16px;
    }
  `]
})
export class UnitLoadStateComponent {
  @Input({ required: true }) state!: LoadFailure;
  @Output() retry = new EventEmitter<void>();

  constructor(private router: Router, private translate: TranslateService) {}

  goToUnits(): void {
    const lang = this.translate.currentLang || 'ar';
    this.router.navigate(['/', lang, 'd3', 'units']);
  }
}
