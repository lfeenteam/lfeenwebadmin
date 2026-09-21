import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-logs-filter',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './logs-filter.component.html',
  styleUrl: './logs-filter.component.scss'
})
export class LogsFilterComponent {
  @Input() searchQuery = '';
  @Input() actionTypes: string[] = [];
  @Input() depts: string[] = [];
  @Input() dates: string[] = [];

  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() filterActionChange = new EventEmitter<string>();
  @Output() filterDeptChange = new EventEmitter<string>();
  @Output() filterDateChange = new EventEmitter<string>();
}
