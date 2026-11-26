import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { isForbiddenError } from '../../../../utils/transport-error.util';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import {
  Observable, Subject, Subscription, catchError, combineLatest, debounceTime,
  distinctUntilChanged, finalize, map, of, startWith, switchMap, tap,
} from 'rxjs';
import { ComplaintService } from '../../services/complaint.service';
import { AssignableEmployee, COMPLAINT_PERMISSION_PREFIXES, isClosedTicketStatus, isInactiveEmployee } from '../../interfaces/complaint.model';
import { PermissionService } from '../../../../services/permission.service';
import { PageBreadcrumbTrailService } from '../../../../services/page-breadcrumb-trail.service';
import { DashboardEmptyComponent } from '../../../../../../../components/dashboard3/dashboard-empty/dashboard-empty.component';
import { appLocale } from 'src/app/utils/locale-format.util';
import { getVisiblePages } from 'src/app/utils/pagination.util';

type ComplaintType = 'customer' | 'host';
type LoadState = 'loading' | 'ready' | 'notFound' | 'error';

interface TicketInfo {
  ticketNumber: string;
  assignedUserId: string | null;
  assignedName: string | null;
  closed: boolean;
}

type LoadResult =
  | { kind: 'ok'; id: string; type: ComplaintType; info: TicketInfo }
  | { kind: 'notFound' | 'error'; id: string; type: ComplaintType };

interface AssignPageNavState {
  complaintType?: ComplaintType;
}

@Component({
  selector: 'app-assign-employee-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent],
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
  private destroyRef = inject(DestroyRef);
  private perms = inject(PermissionService);
  /** BUG-2739: assigning needs a tickets write permission, not just a view one. */
  readonly canManage = computed(() => this.perms.canWrite(COMPLAINT_PERMISSION_PREFIXES));
  private search$ = new Subject<string>();
  private reload$ = new Subject<void>();
  private employeesSub?: Subscription;

  /** Ticket currently in the URL — every write targets this, and async results
   * are dropped if it changed while they were in flight. */
  private ticketExternalId = '';
  private complaintType: ComplaintType = 'customer';
  private triedNamePreselect = false;

  loadState = signal<LoadState>('loading');
  /** The failed load was a 403 — the inline error says "no permission" (BUG-2496). */
  loadForbidden = signal(false);
  ticketClosed = signal(false);
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

  // Router state only applies to the navigation that created the page — later
  // :id changes (address bar, back/forward) come with no state of their own.
  private initialNavState: AssignPageNavState | null =
    (this.router.getCurrentNavigation()?.extras.state as AssignPageNavState | undefined) ??
    (window.history.state as AssignPageNavState | undefined) ??
    null;
  private navStateTicketId: string | null = null;

  ngOnInit(): void {
    // The component is reused when only :id changes, so follow the params
    // instead of reading the snapshot once.
    combineLatest([
      this.route.paramMap,
      this.route.queryParamMap,
      this.reload$.pipe(startWith(undefined)),
    ]).pipe(
      map(([params, query]) => ({ id: params.get('id') ?? '', type: this.resolveType(params.get('id') ?? '', query.get('type')) })),
      tap(({ id, type }) => this.resetFor(id, type)),
      switchMap(({ id, type }) => this.fetchTicket(id, type)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(result => {
      if (result.id !== this.ticketExternalId || result.type !== this.complaintType) return;
      if (result.kind !== 'ok') {
        this.loadState.set(result.kind);
        return;
      }
      this.loadForbidden.set(false);
      this.applyTicketInfo(result.info);
      this.loadState.set('ready');
      if (!result.info.closed) this.loadEmployees(this.searchTerm());
    });

    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(term => this.loadEmployees(term));
  }

  ngOnDestroy(): void {
    this.employeesSub?.unsubscribe();
    this.breadcrumbTrail.clear();
  }

  retryLoad(): void {
    this.reload$.next();
  }

  backToList(): void {
    const lang = this.translate.currentLang || 'ar';
    this.router.navigate([lang, 'd3', 'complaints'], {
      queryParams: this.complaintType === 'host' ? { tab: 'hosts' } : { tab: 'customers', type: 'customer' },
    });
  }

  // Router state doesn't survive a hard reload — the query param is the fallback
  // source of truth for which endpoint to fetch from.
  private resolveType(id: string, typeParam: string | null): ComplaintType {
    // Bind the router state to the ticket it was created for, so it never leaks
    // onto a different :id later.
    if (this.initialNavState && this.navStateTicketId === null) this.navStateTicketId = id;
    const fromState = id === this.navStateTicketId ? this.initialNavState?.complaintType : undefined;
    return fromState ?? (typeParam === 'host' ? 'host' : 'customer');
  }

  /** Clears everything tied to the previous ticket so a stale selection or
   * ticket number can never be submitted against the ticket now in the URL. */
  private resetFor(id: string, type: ComplaintType): void {
    this.ticketExternalId = id;
    this.complaintType = type;
    this.employeesSub?.unsubscribe();
    this.loadState.set('loading');
    this.ticketClosed.set(false);
    this.ticketNumber.set('');
    this.currentAssignedUserId.set(null);
    this.currentAssignedName.set(null);
    this.selected.set(null);
    this.triedNamePreselect = false;
    this.submitting.set(false);
    this.employees.set([]);
    this.loadingEmployees.set(false);
    this.currentPage.set(1);
    this.totalPages.set(1);
    this.totalCount.set(0);
    this.breadcrumbTrail.clear();
  }

  private fetchTicket(id: string, type: ComplaintType): Observable<LoadResult> {
    if (!id) return of({ kind: 'notFound', id, type });

    const info$: Observable<TicketInfo> = type === 'host'
      ? this.service.getTicketById(id).pipe(map(d => ({
          ticketNumber: d.ticketNumber || id,
          assignedUserId: d.assignedAdminUserId,
          assignedName: d.assignedAdminName,
          closed: isClosedTicketStatus(d.status, d.closedAtUtc),
        })))
      : this.service.getClientTicketById(id).pipe(map(d => ({
          ticketNumber: d.sessionNumber ?? d.ticketNumber ?? id,
          assignedUserId: d.assignedAgentUserId ?? null,
          assignedName: d.assignedAgentName,
          closed: isClosedTicketStatus(d.status, d.closedAtUtc),
        })));

    return info$.pipe(
      map((info): LoadResult => ({ kind: 'ok', id, type, info })),
      catchError(err => {
        this.loadForbidden.set(isForbiddenError(err));
        return of<LoadResult>({
          kind: err?.status === 404 || err?.status === 400 ? 'notFound' : 'error',
          id,
          type,
        });
      }),
    );
  }

  private applyTicketInfo(info: TicketInfo): void {
    this.ticketNumber.set(info.ticketNumber);
    this.ticketClosed.set(info.closed);
    this.currentAssignedUserId.set(info.assignedUserId);
    this.currentAssignedName.set(info.assignedName);
    this.breadcrumbTrail.set([{ label: info.ticketNumber, translate: false }]);

    if (info.assignedUserId && info.assignedName) {
      this.selected.set({
        userId: info.assignedUserId,
        fullName: info.assignedName,
        email: '',
        phoneNumber: null,
        isActive: true,
      });
    }
  }

  get canAssign(): boolean {
    return this.loadState() === 'ready' && !this.ticketClosed() && !!this.ticketExternalId && this.canManage();
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
    if (!this.canAssign) return;
    this.employeesSub?.unsubscribe();
    this.loadingEmployees.set(true);
    this.employeesSub = this.service.getAssignableEmployees(search, this.currentPage(), this.pageSize)
      .pipe(finalize(() => this.loadingEmployees.set(false)))
      .subscribe(result => {
        this.employees.set(result.data);
        this.totalPages.set(result.totalPages);
        this.totalCount.set(result.totalCount);
        this.reconcileSelection(result.data);
        this.tryPreselectByName(result.data);
      });
  }

  // The current assignee is pre-selected from the ticket alone, before we know whether
  // they are still active. Once their row shows up, take the real record — and drop the
  // selection if they've been deactivated, so confirm can't re-assign to them (BUG-2501).
  private reconcileSelection(list: AssignableEmployee[]): void {
    const current = this.selected();
    if (!current) return;
    const match = list.find(e => e.userId === current.userId);
    if (!match) return;
    this.selected.set(isInactiveEmployee(match) ? null : match);
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
    if (match && !isInactiveEmployee(match)) this.selected.set(match);
  }

  isInactive(employee: AssignableEmployee): boolean {
    return isInactiveEmployee(employee);
  }

  select(employee: AssignableEmployee): void {
    if (isInactiveEmployee(employee)) return;
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
    if (!employee || isInactiveEmployee(employee) || this.submitting() || !this.canAssign) return;

    // Pin the target once: the assignment and the redirect go to the ticket
    // that was on screen when the admin pressed confirm.
    const id = this.ticketExternalId;
    const type = this.complaintType;

    this.submitting.set(true);
    const request$ = type === 'host'
      ? this.service.assignTicket(id, employee.userId)
      : this.service.assignClientTicket(id, employee.userId);
    request$
      .pipe(
        finalize(() => { if (id === this.ticketExternalId) this.submitting.set(false); }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.toastr.success(this.translate.instant('d3.complaints.assignDialog.success'));
          // The admin moved to another ticket meanwhile — don't yank them back.
          if (id === this.ticketExternalId) this.returnToTicket(id, type);
        },
        error: err => this.toastr.error(this.service.assignErrorMessage(err) ?? this.translate.instant('d3.toast.errorOp'))
      });
  }

  // Navigate back deliberately (instead of window.history.back()) so the ticket list
  // reopens the just-assigned ticket with fresh data, rather than leaving the chat
  // closed with no visible confirmation that the assignment actually took effect.
  private returnToTicket(id: string, type: ComplaintType): void {
    const lang = this.translate.currentLang || 'ar';
    if (type === 'host') {
      // Host tickets have their own detail route and are never fetched via
      // getClientTicketById — the customers-tab openTicket query param would
      // wrongly call the client-tickets endpoint with a host ticket id.
      this.router.navigate([lang, 'd3', 'complaints', id], {
        queryParams: { tab: 'hosts' },
      });
      return;
    }
    this.router.navigate([lang, 'd3', 'complaints'], {
      queryParams: { tab: 'customers', type: 'customer', openTicket: id },
    });
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  // Compact list (1 2 3 4 … 13 14 15) so the pager fits a phone screen.
  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage(), this.totalPages());
  }

  displayPage(page: number): string {
    return new Intl.NumberFormat(appLocale(this.currentDir === 'rtl' ? 'ar' : 'en')).format(page);
  }

  get paginationSummary(): string {
    const formatter = new Intl.NumberFormat(appLocale(this.currentDir === 'rtl' ? 'ar' : 'en'));
    const total = formatter.format(this.totalCount());
    const shownCount = Math.min(((this.currentPage() - 1) * this.pageSize) + this.employees().length, this.totalCount());
    const shown = formatter.format(shownCount);

    return this.currentDir === 'rtl'
      ? `عرض ${shown} من أصل ${total} موظف`
      : `Showing ${shown} of ${total} employees`;
  }
}
