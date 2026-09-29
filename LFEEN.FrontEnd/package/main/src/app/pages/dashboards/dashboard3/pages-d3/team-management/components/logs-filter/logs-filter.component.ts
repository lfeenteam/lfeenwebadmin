import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { AdminAuditStatus, AuditDatePreset } from '../../../../interfaces/operation-audit.model';

export interface LogsFilterOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-logs-filter',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './logs-filter.component.html',
  styleUrl: './logs-filter.component.scss'
})
export class LogsFilterComponent {
  @Input() actionCodes: readonly string[] = [];
  @Input() depts: LogsFilterOption[] = [];
  @Input() statuses: readonly AdminAuditStatus[] = [];
  @Input() datePresets: readonly AuditDatePreset[] = ['today', 'week', 'month'];

  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() filterActionChange = new EventEmitter<string>();
  @Output() filterDeptChange = new EventEmitter<string>();
  @Output() filterStatusChange = new EventEmitter<string>();
  @Output() filterDateChange = new EventEmitter<AuditDatePreset | ''>();
}
