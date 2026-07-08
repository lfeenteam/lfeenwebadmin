import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { ComplaintService } from '../../services/complaint.service';
import { AssignableEmployee } from '../../interfaces/complaint.model';
import { PageBreadcrumbTrailService } from '../../../../services/page-breadcrumb-trail.service';

interface AssignPageNavState {
  ticketNumber?: string;
  complaintType?: 'customer' | 'host';
  assignedAdminUserId?: string | null;
  assignedAdminName?: string | null;
}

@Component({
  selector: 'app-assign-employee-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './assign-employee-page.component.html',
  styleUrl: './assign-employee-page.component.scss'
})
export class AssignEmployeePageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(ComplaintService);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private breadcrumbTrail = inject(PageBreadcrumbTrailService);
  private search$ = new Subject<string>();

  private ticketExternalId = '';
  private complaintType: 'customer' | 'host' = 'customer';
  private triedNamePreselect = false;
  ticketNumber = signal('');
  currentAssignedUserId = signal<string | null>(null);
  currentAssignedName = signal<string | null>(null);

  employees = signal<AssignableEmployee[]>([]);
  loadingEmployees = signal(false);
  submitting = signal(false);
  searchTerm = signal('');
  selected = signal<AssignableEmployee | null>(null);
  currentPage = signal(1);
  totalPages = signal(1);
  totalCount = signal(0);
  readonly pageSize = 8;

  private navState: AssignPageNavState | null =
    (this.router.getCurrentNavigation()?.extras.state as AssignPageNavState | undefined) ??
    (window.history.state as AssignPageNavState | undefined) ??
    null;

  ngOnInit(): void {
    this.ticketExternalId = this.route.snapshot.paramMap.get('id') ?? '';
    // Router state doesn't survive a hard reload — the query param is the fallback
    // source of truth for which endpoint to refetch from below.
    const typeParam = this.route.snapshot.queryParamMap.get('type');
    this.complaintType = this.navState?.complaintType
      ?? (typeParam === 'host' ? 'host' : 'customer');

    if (this.navState?.ticketNumber || this.navState?.assignedAdminName) {
      this.applyTicketInfo(
        this.navState.ticketNumber ?? this.ticketExternalId,
        this.navState.assignedAdminUserId ?? null,
        this.navState.assignedAdminName ?? null
      );
    } else if (this.ticketExternalId && this.complaintType === 'host') {
      this.service.getTicketById(this.ticketExternalId).subscribe({
        next: detail => this.applyTicketInfo(detail.ticketNumber, detail.assignedAdminUserId, detail.assignedAdminName),
        error: () => this.applyTicketInfo(this.ticketExternalId, null, null),
      });
    } else if (this.ticketExternalId) {
      this.service.getClientTicketById(this.ticketExternalId).subscribe({
        next: detail => this.applyTicketInfo(detail.ticketNumber, null, detail.assignedAgentName),
        error: () => this.applyTicketInfo(this.ticketExternalId, null, null),
      });
    }

    this.loadEmployees();
    this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(term => this.loadEmployees(term));
  }

  ngOnDestroy(): void {
    this.breadcrumbTrail.clear();
  }

  private applyTicketInfo(ticketNumber: string, assignedUserId: string | null, assignedName: string | null): void {
    this.ticketNumber.set(ticketNumber);
    this.currentAssignedUserId.set(assignedUserId);
    this.currentAssignedName.set(assignedName);
    this.breadcrumbTrail.set([{ label: ticketNumber, translate: false }]);

    if (assignedUserId && assignedName) {
      this.selected.set({
        userId: assignedUserId,
        fullName: assignedName,
        email: '',
        phoneNumber: null,
        isActive: true,
      });
    }
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.currentPage.set(1);
    this.search$.next(term);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.currentPage.set(page);
    this.loadEmployees(this.searchTerm());
  }

  private loadEmployees(search?: string): void {
    this.loadingEmployees.set(true);
    this.service.getAssignableEmployees(search, this.currentPage(), this.pageSize)
      .pipe(finalize(() => this.loadingEmployees.set(false)))
      .subscribe(result => {
        this.employees.set(result.data);
        this.totalPages.set(result.totalPages);
        this.totalCount.set(result.totalCount);
        this.tryPreselectByName(result.data);
      });
  }

  // Client tickets only expose the current assignee's name (no user id), so
  // applyTicketInfo can't pre-select by id. Once the real employee list loads,
  // try to match it by name instead — best-effort, only on the first load.
  private tryPreselectByName(list: AssignableEmployee[]): void {
    if (this.selected() || this.triedNamePreselect) return;
    const name = this.currentAssignedName();
    if (!name) return;

    this.triedNamePreselect = true;
    const match = list.find(e => e.fullName === name);
    if (match) this.selected.set(match);
  }

  select(employee: AssignableEmployee): void {
    this.selected.set(employee);
  }

  isSelected(employee: AssignableEmployee): boolean {
    return this.selected()?.userId === employee.userId;
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase();
  }

  confirm(): void {
    const employee = this.selected();
    if (!employee || this.submitting() || !this.ticketExternalId) return;

    this.submitting.set(true);
    this.service.assignTicket(this.ticketExternalId, employee.userId, this.complaintType)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.toastr.success(this.translate.instant('d3.complaints.assignDialog.success'));
          this.returnToTicket();
        },
        error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp'))
      });
  }

  // Navigate back deliberately (instead of window.history.back()) so the ticket list
  // reopens the just-assigned ticket with fresh data, rather than leaving the chat
  // closed with no visible confirmation that the assignment actually took effect.
  private returnToTicket(): void {
    const lang = this.translate.currentLang || 'ar';
    if (this.complaintType === 'host') {
      // Host tickets have their own detail route and are never fetched via
      // getClientTicketById — the customers-tab openTicket query param would
      // wrongly call the client-tickets endpoint with a host ticket id.
      this.router.navigate([lang, 'd3', 'complaints', this.ticketExternalId], {
        queryParams: { tab: 'hosts' },
      });
      return;
    }
    this.router.navigate([lang, 'd3', 'complaints'], {
      queryParams: { tab: 'customers', type: 'customer', openTicket: this.ticketExternalId },
    });
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }

  displayPage(page: number): string {
    return new Intl.NumberFormat(this.currentDir === 'rtl' ? 'ar-EG' : 'en-US').format(page);
  }

  get paginationSummary(): string {
    const formatter = new Intl.NumberFormat(this.currentDir === 'rtl' ? 'ar-EG' : 'en-US');
    const total = formatter.format(this.totalCount());
    const shownCount = Math.min(((this.currentPage() - 1) * this.pageSize) + this.employees().length, this.totalCount());
    const shown = formatter.format(shownCount);

    return this.currentDir === 'rtl'
      ? `عرض ${shown} من أصل ${total} موظف`
      : `Showing ${shown} of ${total} employees`;
  }
}
