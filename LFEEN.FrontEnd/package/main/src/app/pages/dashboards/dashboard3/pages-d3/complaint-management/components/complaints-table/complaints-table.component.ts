import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Complaint } from '../../interfaces/complaint.model';

@Component({
  selector: 'app-complaints-table',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './complaints-table.component.html',
  styleUrl: './complaints-table.component.scss'
})
export class ComplaintsTableComponent {
  @Input() complaints: Complaint[] = [];
  @Input() selectedId: string | null = null;

  @Output() rowSelect  = new EventEmitter<Complaint>();
  @Output() resolveRow = new EventEmitter<Complaint>();

  private translate = inject(TranslateService);

  searchQuery = '';

  get filtered(): Complaint[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.complaints;
    return this.complaints.filter(c =>
      c.clientName.toLowerCase().includes(q) ||
      (c.clientNameEn ?? '').toLowerCase().includes(q) ||
      c.clientCode.toLowerCase().includes(q)
    );
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  statusLabelKey(status: Complaint['status']): string {
    const map: Record<string, string> = {
      new:         'd3.complaints.status.new',
      in_progress: 'd3.complaints.status.inProgress',
      closed:      'd3.complaints.status.closed',
      pending:     'd3.complaints.status.pending',
    };
    return map[status] ?? '';
  }

  onResolve(event: Event, complaint: Complaint): void {
    event.stopPropagation();
    this.resolveRow.emit(complaint);
  }

  displayClientName(complaint: Complaint): string {
    return this.translate.currentLang === 'en'
      ? complaint.clientNameEn ?? complaint.clientName
      : complaint.clientName;
  }

  displayDate(complaint: Complaint): string {
    return this.translate.currentLang === 'en'
      ? complaint.dateEn ?? complaint.date
      : complaint.date;
  }
}
