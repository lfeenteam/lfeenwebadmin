import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-tabs-bar',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslateModule],
  templateUrl: './tabs-bar.component.html',
  styleUrl: './tabs-bar.component.scss'
})
export class TabsBarComponent {
  @Input() activeTab: 'structure' | 'employees' | 'logs' = 'structure';
  @Input() noBorder = false;
  @Output() tabChange = new EventEmitter<'structure' | 'employees' | 'logs'>();
}
