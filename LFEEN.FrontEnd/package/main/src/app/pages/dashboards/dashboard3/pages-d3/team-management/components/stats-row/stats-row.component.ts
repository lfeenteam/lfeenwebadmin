import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { StatItem } from '../../../../interfaces/stats.model';
import { CountUpDirective } from '../../../../directives/count-up.directive';

@Component({
  selector: 'app-stats-row',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, CountUpDirective],
  templateUrl: './stats-row.component.html',
  styleUrl: './stats-row.component.scss'
})
export class StatsRowComponent {
  @Input() stats: StatItem[] = [];
  @Input() isDeptView = false;
}
