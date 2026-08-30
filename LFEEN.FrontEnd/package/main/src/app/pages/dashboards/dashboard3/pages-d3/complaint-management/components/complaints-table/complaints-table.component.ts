import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { MatMenu } from '@angular/material/menu';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastrService } from 'ngx-toastr';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { AssignableEmployee, CLIENT_TICKET_DEPARTMENT_OPTIONS, Complaint } from '../../interfaces/complaint.model';
import { LoginService } from '../../../../services/login/login.service';
import { ComplaintService } from '../../services/complaint.service';

@Component({
  selector: 'app-complaints-table',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardLoadingComponent],
  templateUrl: './complaints-table.component.html',
  styleUrl: './complaints-table.component.scss'
})
export class ComplaintsTableComponent implements OnChanges {
  @Input() complaints: Complaint[] = [];
  @Input() selectedId: string | null = null;
  @Input() activeTab: 'customers' | 'hosts' | 'resolved' = 'customers';
  @Input() compact = false;
  @Input() loading = false;

  /** Server-driven pagination/filtering (used for the customers/client-tickets tab). When null, the table falls back to local client-side filtering & pagination. */
  @Input() serverTotalCount: number | null = null;
  @Input() serverTotalPages: number | null = null;
  @Input() serverCurrentPage: number | null = null;
  @Input() statusFilterValue: number | string | null = null;
  @Input() statusOptions: { value: number | string; labelKey: string }[] = [];
  @Input() allOptionLabelKey = 'd3.complaints.table.allStatuses';
  /** Overrides the generic empty-state text (e.g. a host-tab-specific "no tickets match the current filters" message). */
  @Input() emptyMessageKey = 'd3.complaints.table.empty';
  /** Shows a "clear filters" action inside the empty state — only meaningful when filters are actually active. */
  @Input() showClearFiltersInEmpty = false;

  @Output() rowSelect = new EventEmitter<Complaint>();
  @Output() detailSelect = new EventEmitter<Complaint>();
  /** Fired once an employee is picked from the inline assign popover and the assignment call succeeds. */
  @Output() assignConfirm = new EventEmitter<{ complaintId: string; employee: AssignableEmployee }>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() statusFilterChange = new EventEmitter<number | string | null>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() clearFilters = new EventEmitter<void>();

  @ViewChild('assignMenu') assignMenu!: MatMenu;

  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private loginService = inject(LoginService);
  private complaintService = inject(ComplaintService);
  private searchSubject = new Subject<string>();
  private assignSearchSubject = new Subject<string>();

  searchQuery = '';
  currentPage = 1;
  readonly pageSize = 8;

  // ── Inline assign popover state ──────────────────────────────────────────
  assigningComplaint: Complaint | null = null;
  assignSearchTerm = '';
  assignEmployees: AssignableEmployee[] = [];
  assignLoading = false;
  assignSubmitting = false;
  private assignPage = 1;
  private assignTotalPages = 1;
  readonly assignPageSize = 10;

  constructor() {
    this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(term => this.searchChange.emit(term.trim()));

    this.assignSearchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(term => this.loadAssignEmployees(term, true));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['complaints'] && !this.serverMode) {
      this.currentPage = 1;
    }
    if (changes['serverCurrentPage'] && this.serverCurrentPage != null) {
      this.currentPage = this.serverCurrentPage;
    }
  }

  get serverMode(): boolean {
    return this.serverTotalCount !== null;
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
    if (this.serverMode) return this.complaints;
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
    if (this.serverMode) return Math.max(1, this.serverTotalPages ?? 1);
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }

  get visiblePages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    if (this.serverMode) {
      this.pageChange.emit(page);
    }
  }

  onSearchInput(value: string): void {
    this.currentPage = 1;
    if (this.serverMode) {
      this.searchSubject.next(value);
    }
  }

  get selectedStatusLabel(): string {
    if (this.statusFilterValue == null) return this.allOptionLabelKey;
    return this.statusOptions.find(o => o.value === this.statusFilterValue)?.labelKey ?? this.allOptionLabelKey;
  }

  onStatusSelect(value: number | string | null): void {
    this.currentPage = 1;
    this.statusFilterChange.emit(value);
  }

  displayPage(page: number): string {
    return new Intl.NumberFormat(this.currentDir === 'rtl' ? 'ar-EG' : 'en-US').format(page);
  }

  get paginationSummary(): string {
    const formatter = new Intl.NumberFormat(this.currentDir === 'rtl' ? 'ar-EG' : 'en-US');

    if (this.serverMode) {
      const totalCount = this.serverTotalCount ?? 0;
      const shownCount = Math.min(((this.currentPage - 1) * this.pageSize) + this.complaints.length, totalCount);
      const total = formatter.format(totalCount);
      const shown = formatter.format(shownCount);
      return this.currentDir === 'rtl'
        ? `عرض ${shown} من أصل ${total} تذكرة`
        : `Showing ${shown} of ${total} tickets`;
    }

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

  /** Truncates by word count (not characters) so short words aren't cut mid-word —
   * used for the subject column, which only has room for a few words per row. */
  private truncateWords(text: string, wordLimit = 4): string {
    const words = text.trim().split(/\s+/);
    return words.length > wordLimit ? `${words.slice(0, wordLimit).join(' ')}...` : text;
  }

  displaySubject(complaint: Complaint): string {
    if (complaint.subject) {
      const text = this.translate.currentLang === 'en'
        ? complaint.subjectEn ?? complaint.subject
        : complaint.subject;
      return this.truncateWords(text);
    }

    const firstMessage = complaint.messages[0];
    if (!firstMessage) {
      return this.currentDir === 'rtl' ? 'تأخري في تسوية دفعات شهر سبتمبر' : 'Delay in September payout settlement';
    }

    const content = this.translate.currentLang === 'en'
      ? firstMessage.contentEn ?? firstMessage.content
      : firstMessage.content;

    return this.truncateWords(content);
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

  displayPropertyName(complaint: Complaint): string {
    return complaint.propertyName ?? '-';
  }

  displayDepartmentName(complaint: Complaint): string {
    return complaint.departmentName ?? '-';
  }

  /** Client tickets return the raw department enum ("General"…); map it to its i18n key
   * so the label follows the current language. Falls back to the raw value. */
  clientDepartmentLabel(complaint: Complaint): string {
    if (!complaint.department) return '-';
    const key = CLIENT_TICKET_DEPARTMENT_OPTIONS.find(o => o.value === complaint.department)?.labelKey;
    return key ? this.translate.instant(key) : complaint.department;
  }

  displayAssignedAdminName(complaint: Complaint): string {
    return complaint.assignedAdminName ?? this.translate.instant('d3.complaints.hostFilters.notAssigned');
  }

  get searchPlaceholder(): string {
    if (this.resolvedMode) {
      return this.currentDir === 'rtl'
        ? 'بحث باسم المستخدم، رقم التذكرة، أو الموضوع...'
        : 'Search by user, ticket number, or subject...';
    }
    return this.translate.instant('d3.complaints.table.searchPlaceholder');
  }

  isAssignedToMe(complaint: Complaint): boolean {
    const user = this.loginService.getUser();
    if (!user) return false;
    // Host tickets carry a real assignedAdminUserId — compare by id when we have one.
    // Client tickets never get an id back from the backend (only the assignee's name),
    // so fall back to a name match for those.
    if (complaint.assignedAdminUserId) {
      return complaint.assignedAdminUserId === user.userId;
    }
    return !!user.fullName && user.fullName === complaint.assignedAdminName;
  }

  /** Hours of no activity on a ticket still awaiting the assigned agent's action before
   * it's considered stalled and opened up for reassignment. */
  private readonly delayThresholdMs = 6 * 60 * 60 * 1000;

  /** True once an assigned ticket has sat with no activity past the threshold while still
   * awaiting the agent's own action — 'replied'/'closed' mean the ball is elsewhere
   * (client/host, or resolved), so those never count as the agent stalling.
   * lastMessageAtUtc is the closest signal available — the API doesn't expose who sent
   * the last message or when the ticket was assigned, so this is an approximation. */
  isDelayed(complaint: Complaint): boolean {
    if (!complaint.assignedAdminName) return false;
    if (complaint.status === 'replied' || complaint.status === 'closed') return false;
    if (!complaint.lastMessageAtUtc) return false;
    return Date.now() - new Date(complaint.lastMessageAtUtc).getTime() > this.delayThresholdMs;
  }

  /** Locked only once someone has actually engaged with the ticket (status moved past 'new') —
   * a bare assignment with no reply yet still lets anyone reassign it. My own tickets are never
   * locked, and neither are stalled ones (isDelayed) — a non-responsive assignee shouldn't block
   * someone else from picking it up. */
  isAssignLocked(complaint: Complaint): boolean {
    if (!complaint.assignedAdminName || this.isAssignedToMe(complaint)) return false;
    if (this.isDelayed(complaint)) return false;
    return complaint.status !== 'new';
  }

  onAssignBtnClick(complaint: Complaint): void {
    if (this.isAssignLocked(complaint)) {
      this.toastr.info(this.translate.instant('d3.complaints.table.assignLockedMsg'));
      return;
    }
    this.assigningComplaint = complaint;
    this.assignSearchTerm = '';
    this.assignEmployees = [];
    this.assignPage = 1;
    this.assignTotalPages = 1;
    this.loadAssignEmployees();
  }

  /** null closes the popover for locked rows without opening the shared mat-menu instance. */
  assignMenuFor(complaint: Complaint): MatMenu | null {
    return this.isAssignLocked(complaint) ? null : this.assignMenu;
  }

  onAssignMenuClosed(): void {
    this.assigningComplaint = null;
    this.assignEmployees = [];
    this.assignSearchTerm = '';
  }

  onAssignSearchChange(term: string): void {
    this.assignSearchTerm = term;
    this.assignSearchSubject.next(term);
  }

  private loadAssignEmployees(search = this.assignSearchTerm, reset = false): void {
    if (reset) {
      this.assignPage = 1;
      this.assignEmployees = [];
    }
    this.assignLoading = true;
    this.complaintService.getAssignableEmployees(search || undefined, this.assignPage, this.assignPageSize)
      .pipe(finalize(() => this.assignLoading = false))
      .subscribe(result => {
        this.assignEmployees = this.assignPage === 1 ? result.data : [...this.assignEmployees, ...result.data];
        this.assignTotalPages = result.totalPages;
      });
  }

  onAssignListScroll(event: Event): void {
    if (this.assignLoading || this.assignPage >= this.assignTotalPages) return;
    const el = event.target as HTMLElement;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
      this.assignPage += 1;
      this.loadAssignEmployees(this.assignSearchTerm);
    }
  }

  isAssignSelected(employee: AssignableEmployee): boolean {
    return this.assigningComplaint?.assignedAdminUserId === employee.userId;
  }

  getAssignInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  }

  selectAssignEmployee(employee: AssignableEmployee): void {
    const complaint = this.assigningComplaint;
    if (!complaint || this.assignSubmitting) return;

    this.assignSubmitting = true;
    const request$ = complaint.type === 'customer'
      ? this.complaintService.assignClientTicket(complaint.id, employee.userId)
      : this.complaintService.assignTicket(complaint.id, employee.userId);
    request$
      .pipe(finalize(() => this.assignSubmitting = false))
      .subscribe({
        next: () => {
          this.toastr.success(this.translate.instant('d3.complaints.assignDialog.success'));
          this.assignConfirm.emit({ complaintId: complaint.id, employee });
        },
        error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp')),
      });
  }

  onResolvedAction(complaint: Complaint): void {
    if (complaint.type === 'customer') {
      this.rowSelect.emit(complaint);
    } else {
      this.detailSelect.emit(complaint);
    }
  }
}
