import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
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
export class ComplaintsTableComponent implements OnChanges {
  @Input() complaints: Complaint[] = [];
  @Input() selectedId: string | null = null;
  @Input() activeTab: 'customers' | 'hosts' | 'resolved' = 'customers';
  @Input() compact = false;

  @Output() rowSelect = new EventEmitter<Complaint>();
  @Output() detailSelect = new EventEmitter<Complaint>();

  private translate = inject(TranslateService);

  searchQuery = '';
  currentPage = 1;
  readonly pageSize = 8;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['complaints']) {
      this.currentPage = 1;
    }
  }

  get filtered(): Complaint[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.complaints;
    return this.complaints.filter(c =>
      c.clientName.toLowerCase().includes(q) ||
      (c.clientNameEn ?? '').toLowerCase().includes(q) ||
      c.clientCode.toLowerCase().includes(q) ||
      (c.subject ?? '').toLowerCase().includes(q) ||
      (c.subjectEn ?? '').toLowerCase().includes(q)
    );
  }

  get pagedComplaints(): Complaint[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  get hostSupportMode(): boolean {
    return this.activeTab === 'hosts';
  }

  get resolvedMode(): boolean {
    return this.activeTab === 'resolved';
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }

  get visiblePages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  displayPage(page: number): string {
    return new Intl.NumberFormat(this.currentDir === 'rtl' ? 'ar-EG' : 'en-US').format(page);
  }

  get paginationSummary(): string {
    const formatter = new Intl.NumberFormat(this.currentDir === 'rtl' ? 'ar-EG' : 'en-US');
    const total = formatter.format(this.filtered.length);
    const shown = formatter.format(Math.min(this.currentPage * this.pageSize, this.filtered.length));

    return this.currentDir === 'rtl'
      ? `عرض ${shown} من أصل ${total} شكوى`
      : `Showing ${shown} of ${total} complaints`;
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
      replied:     'd3.complaints.status.replied',
    };
    return map[status] ?? '';
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

  displaySubject(complaint: Complaint): string {
    if (complaint.subject) {
      const text = this.translate.currentLang === 'en'
        ? complaint.subjectEn ?? complaint.subject
        : complaint.subject;
      return text.length > 68 ? `${text.slice(0, 68)}...` : text;
    }

    const firstMessage = complaint.messages[0];
    if (!firstMessage) {
      return this.currentDir === 'rtl' ? 'تأخري في تسوية دفعات شهر سبتمبر' : 'Delay in September payout settlement';
    }

    const content = this.translate.currentLang === 'en'
      ? firstMessage.contentEn ?? firstMessage.content
      : firstMessage.content;

    return content.length > 68 ? `${content.slice(0, 68)}...` : content;
  }

  displayResolvedSubject(complaint: Complaint): string {
    if (complaint.subject) {
      const text = this.translate.currentLang === 'en'
        ? complaint.subjectEn ?? complaint.subject
        : complaint.subject;
      return text.length > 50 ? `${text.slice(0, 50)}...` : text;
    }
    return this.displaySubject(complaint);
  }

  displayReplyDate(complaint: Complaint): string {
    if (complaint.replyDate) {
      return this.translate.currentLang === 'en'
        ? complaint.replyDateEn ?? complaint.replyDate
        : complaint.replyDate;
    }
    return this.displayDate(complaint);
  }

  get searchPlaceholder(): string {
    if (this.resolvedMode) {
      return this.currentDir === 'rtl'
        ? 'بحث باسم المستخدم، رقم التذكرة، أو الموضوع...'
        : 'Search by user, ticket number, or subject...';
    }
    return this.translate.instant('d3.complaints.table.searchPlaceholder');
  }

  onResolvedAction(complaint: Complaint): void {
    if (complaint.type === 'customer') {
      this.rowSelect.emit(complaint);
    } else {
      this.detailSelect.emit(complaint);
    }
  }
}
