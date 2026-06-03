import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-stats-row',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './stats-row.component.html',
  styleUrl: './stats-row.component.scss'
})
export class StatsRowComponent {
  @Input() stats: any[] = [];
  @Input() isDeptView = false;
}
