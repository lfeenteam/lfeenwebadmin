import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';

export interface OpsLog {
  id: string;
  date: string;
  time: string;
  user: { name: string; role: string; avatar: string | null; isCrown: boolean };
  actionText: string;
  actionIcon: string;
  department: string;
  status: 'completed' | 'failed' | 'pending';
  statusLabel: string;
}

@Component({
  selector: 'app-ops-log-table',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './ops-log-table.component.html',
  styleUrl: './ops-log-table.component.scss'
})
export class OpsLogTableComponent {
  @Input() logs: OpsLog[] = [];
  @Input() displayedColumns = ['dateTime', 'user', 'action', 'department', 'status', 'expand'];

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('');
  }
}
