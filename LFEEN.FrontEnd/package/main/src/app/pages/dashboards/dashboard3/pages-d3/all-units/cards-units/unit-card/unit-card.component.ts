import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { UnitCardItem } from '../../unit-card.model';

@Component({
  selector: 'app-unit-card',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './unit-card.component.html',
  styleUrl: './unit-card.component.scss'
})
export class UnitCardComponent {
  @Input() unit!: UnitCardItem;
}
