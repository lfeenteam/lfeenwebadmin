import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
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
}
