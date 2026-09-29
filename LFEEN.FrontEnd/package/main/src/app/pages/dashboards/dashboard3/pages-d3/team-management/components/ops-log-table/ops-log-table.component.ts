import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { AdminOperationAuditItem } from '../../../../interfaces/operation-audit.model';
import {
  auditActionIcon,
  auditDepartmentName,
  auditInitials,
  auditStatusClass,
  auditStatusKey,
  formatAuditDate
} from './audit-presentation';

@Component({
  selector: 'app-ops-log-table',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './ops-log-table.component.html',
  styleUrl: './ops-log-table.component.scss'
})
export class OpsLogTableComponent {
  @Input() logs: AdminOperationAuditItem[] = [];
  @Input() currentLang = 'ar';
  @Input() isLoading = false;
  @Input() currentPage = 1;
  @Input() totalPages = 1;
  @Input() totalCount = 0;
  @Input() displayedColumns = ['dateTime', 'user', 'action', 'department', 'status', 'expand'];

  @Output() openDetails = new EventEmitter<AdminOperationAuditItem>();
  @Output() pageChange = new EventEmitter<number>();

  readonly actionIcon = auditActionIcon;
  readonly statusClass = auditStatusClass;
  readonly statusKey = auditStatusKey;
  readonly departmentName = auditDepartmentName;
  readonly initials = auditInitials;

  // The audit log grows without bound, so show a 5-page window around the current page.
  get pageNumbers(): number[] {
    const windowSize = 5;
    const start = Math.max(1, Math.min(this.currentPage - 2, this.totalPages - windowSize + 1));
    const end = Math.min(this.totalPages, start + windowSize - 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  formatDate(value: string): { date: string; time: string } {
    return formatAuditDate(value, this.currentLang);
  }
}
