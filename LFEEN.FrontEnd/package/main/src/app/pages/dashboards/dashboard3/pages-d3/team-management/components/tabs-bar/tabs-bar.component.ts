import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-tabs-bar',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslateModule, TablerIconsModule],
  templateUrl: './tabs-bar.component.html',
  styleUrl: './tabs-bar.component.scss'
})
export class TabsBarComponent {
  @Input() activeTab: 'structure' | 'employees' | 'logs' = 'structure';
  @Input() noBorder = false;
  /** Operation audit tab requires the OperationAudits.View permission. */
  @Input() showLogs = false;
  @Output() tabChange = new EventEmitter<'structure' | 'employees' | 'logs'>();
}
