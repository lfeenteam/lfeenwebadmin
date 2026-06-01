import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { BuildingWithUnits } from '../unit-card.model';
import { UnitCardComponent } from './unit-card/unit-card.component';

@Component({
  selector: 'app-cards-units',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, UnitCardComponent],
  templateUrl: './cards-units.component.html',
  styleUrl: './cards-units.component.scss'
})
export class CardsUnitsComponent {
  @Input() buildings: BuildingWithUnits[] = [];
}
