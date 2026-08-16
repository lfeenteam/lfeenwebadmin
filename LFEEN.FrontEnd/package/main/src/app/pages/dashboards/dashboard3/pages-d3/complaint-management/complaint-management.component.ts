import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, finalize, map, of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ComplaintTabsBarComponent } from './components/complaint-tabs-bar/complaint-tabs-bar.component';
import { ComplaintsTableComponent } from './components/complaints-table/complaints-table.component';
import { ComplaintChatComponent } from './components/complaint-chat/complaint-chat.component';
import { TabsFilterComponent, BuildFilterOption } from '../all-builds/tabs-filter/tabs-filter.component';
import { ComplaintService } from './services/complaint.service';
import { AssignableEmployee, CLIENT_TICKETS_PAGE_SIZE, CLIENT_TICKET_STATUS_OPTIONS, Complaint, ComplaintTab, HOST_TICKETS_PAGE_SIZE, RESOLVED_TICKETS_PAGE_SIZE, RESOLVED_TYPE_OPTIONS, TicketPropertyFilterItem } from './interfaces/complaint.model';
import { ClientSupportHubService } from '../../services/client-support-hub.service';

@Component({
  selector: 'app-complaint-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    TablerIconsModule,
    ComplaintTabsBarComponent,
    ComplaintsTableComponent,
    ComplaintChatComponent,
    TabsFilterComponent,
  ],
  templateUrl: './complaint-management.component.html',
  styleUrl: './complaint-management.component.scss'
})
export class ComplaintManagementComponent implements OnDestroy {
  private service = inject(ComplaintService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private hub = inject(ClientSupportHubService);
  private toastr = inject(ToastrService);
  private hubSubs = new Subscription();
  private hostSearchSub?: Subscription;
  private hostSearchSubject = new Subject<string>();
  private langSub?: Subscription;
  private currentLangSignal = signal(this.translate.currentLang || this.translate.defaultLang || 'ar');

  activeTab         = signal<ComplaintTab>('customers');
  selectedComplaint = signal<Complaint | null>(null);
  loading           = signal(false);

  private resolvedTickets = signal<Complaint[]>([]);

  readonly clientStatusOptions = CLIENT_TICKET_STATUS_OPTIONS;
  // customerAllTickets: the paginated main list from GET /api/client-tickets.
  // customerQueueTickets: PendingAgent tickets from GET /api/client-tickets/queue, kept
  // separate so a live queue refresh never clobbers the main list or its pagination.
  // customerDisplayTickets (below) derives the merged, deduped, priority-first view.
  customerAllTickets  = signal<Complaint[]>([]);
  customerQueueTickets = signal<Complaint[]>([]);
  customerTotalCount  = signal<number | null>(null);
  customerTotalPages  = signal(1);
  customerPage        = signal(1);
  customerSearch      = signal('');
  customerStatus      = signal<number | null>(null);

  // Queue-priority ordering only applies to the default, unfiltered first page — the same
  // guard already used for live NewClientTicket inserts — so it never fights search/filter/
  // pagination results with tickets that don't belong in them.
  private customerQueueApplicable = computed(() =>
    this.customerPage() === 1 && !this.customerSearch() && this.customerStatus() === null
  );

  customerDisplayTickets = computed<Complaint[]>(() => {
    const all = this.customerAllTickets();
    if (!this.customerQueueApplicable()) return all;
    const queue = this.customerQueueTickets();
    if (!queue.length) return all;
    const queueIds = new Set(queue.map(c => c.id));
    return [...queue, ...all.filter(c => !queueIds.has(c.id))];
  });

  hostTickets     = signal<Complaint[]>([]);
  hostTotalCount  = signal<number | null>(null);
  hostTotalPages  = signal(1);
  hostPage        = signal(1);
  hostSearch      = signal('');
  hostPropertyId  = signal<number | null>(null);
  hostAssignedAdminUserId = signal<string | null>(null);
  hostError       = signal(false);

  hostProperties  = signal<TicketPropertyFilterItem[]>([]);
  hostEmployees   = signal<AssignableEmployee[]>([]);

  hostHasActiveFilters = computed(() =>
    !!this.hostSearch() ||
    this.hostPropertyId() !== null ||
    this.hostAssignedAdminUserId() !== null
  );

  /** Unified search + dropdown bar for the hosts tab, styled like the Units/Builds pages.
   * `computed()` keeps this reference-stable across repeated reads within the same change
   * detection cycle — using plain getters here previously produced a fresh array every read,
   * which tripped Angular's dev-mode ExpressionChangedAfterItHasBeenChecked check the first
   * time this section entered the DOM and broke the tab switch until a hard reload. */
  readonly hostFilterOptions = computed<BuildFilterOption[]>(() => {
    const allItem = (labelKey: string) => ({ value: 'all', labelKey });
    return [
      {
        id: 'property',
        labelKey: 'd3.complaints.hostFilters.allProperties',
        items: [
          allItem('d3.complaints.hostFilters.allProperties'),
          ...(Array.isArray(this.hostProperties()) ? this.hostProperties() : [])
            .map(p => ({ value: String(p.propertyId), labelKey: p.name })),
        ],
      },
      {
        id: 'employee',
        labelKey: 'd3.complaints.hostFilters.allEmployees',
        items: [
          allItem('d3.complaints.hostFilters.allEmployees'),
          ...(Array.isArray(this.hostEmployees()) ? this.hostEmployees() : [])
            .map(e => ({ value: e.userId, labelKey: e.fullName })),
        ],
      },
    ];
  });

  readonly hostActiveFiltersSnapshot = computed<Record<string, string>>(() => ({
    property: this.hostPropertyId() !== null ? String(this.hostPropertyId()) : 'all',
    employee: this.hostAssignedAdminUserId() ?? 'all',
  }));

  readonly resolvedTypeOptions = RESOLVED_TYPE_OPTIONS;
  resolvedTotalCount  = signal<number | null>(null);
  resolvedTotalPages  = signal(1);
  resolvedPage        = signal(1);
  resolvedSearch      = signal('');
  resolvedType        = signal<'Client' | 'Merchant' | null>(null);

  constructor() {
    const tab = this.route.snapshot.queryParamMap.get('tab') as ComplaintTab | null;
    if (tab === 'customers' || tab === 'hosts' || tab === 'resolved') {
      this.activeTab.set(tab);
    }
    this.loadTabData(this.activeTab());
    this.loadQueueTickets();
    this.watchLiveUpdates();
    this.loadHostFilterSources();

    this.hostSearchSub = this.hostSearchSubject
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(term => this.applyHostSearch(term));

    // departmentName/statusName/priorityName come back from the API already localized
    // based on the Accept-Language header, so a lang switch needs a refetch of the active
    // tab to pick up the new language — the same pattern all-bookings/all-units use.
    this.langSub = this.translate.onLangChange.subscribe(({ lang }) => {
      this.currentLangSignal.set(lang);
      this.loadTabData(this.activeTab());
      this.loadHostFilterSources();
    });

    const openTicketId = this.route.snapshot.queryParamMap.get('openTicket');
    if (openTicketId) {
      const ticketType = this.route.snapshot.queryParamMap.get('type');
      const inferredType: Complaint['type'] =
        ticketType === 'host' || this.activeTab() === 'hosts' ? 'host' : 'customer';
      this.openTicketById(openTicketId, inferredType);
    }
  }

  private openTicketById(id: string, type: Complaint['type']): void {
    if (type === 'host') {
      this.router.navigate(
        [this.translate.currentLang || 'ar', 'd3', 'complaints', id],
        { queryParams: { tab: 'hosts' }, replaceUrl: true }
      );
      return;
    }

    // Deep links only carry the session/ticket id, not the chatExternalId the chat endpoint
    // needs — resolve it here first, then load the full chat thread.
    this.service.getClientTicketById(id).subscribe({
      next: ticket => {
        const fallback = this.service.mapClientTicketDetailToComplaint(ticket);
        if (!ticket.chatExternalId) {
          this.selectedComplaint.set(fallback);
          return;
        }
        this.service.getClientChatById(ticket.chatExternalId).subscribe({
          next: chat => this.selectedComplaint.set(this.service.mapClientChatToComplaint(chat, fallback)),
          error: () => this.selectedComplaint.set(fallback),
        });
      },
      error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp')),
    });
  }

  ngOnDestroy(): void {
    this.hubSubs.unsubscribe();
    this.hostSearchSub?.unsubscribe();
    this.langSub?.unsubscribe();
  }

  private watchLiveUpdates(): void {
    // NewClientTicket/SessionEscalated only tell us *that* something changed, not the full
    // row data needed to render it — so they're used purely as a trigger to refetch the
    // queue and re-merge, never to synthesize a partial ticket into the list.
    this.hubSubs.add(
      this.hub.newClientTicket$.subscribe(() => this.loadQueueTickets())
    );

    this.hubSubs.add(
      this.hub.sessionEscalated$.subscribe(() => this.loadQueueTickets())
    );

    // Another agent claimed a session that was in our queue — refresh so it drops out
    // of the priority section immediately.
    this.hubSubs.add(
      this.hub.sessionClaimed$.subscribe(() => this.loadQueueTickets())
    );

    // A session only needs a queue refresh if it was actually put back into PendingAgent.
    this.hubSubs.add(
      this.hub.agentReleased$.subscribe(event => {
        if (event.requeued) this.loadQueueTickets();
      })
    );

    // Status moved to Resolved/Closed* — it no longer belongs in the priority queue.
    this.hubSubs.add(
      this.hub.sessionResolved$.subscribe(() => this.loadQueueTickets())
    );

    this.hubSubs.add(
      this.hub.newClientMessage$.subscribe(event => {
        // This is a personal notification for tickets NOT currently open — if it's the
        // open chat, NewMessage already rendered it live there; nothing to do here.
        if (this.selectedComplaint()?.chatExternalId === event.chatExternalId) return;
        this.customerAllTickets.update(list => {
          const ticket = list.find(c => c.chatExternalId === event.chatExternalId);
          if (!ticket) return list;
          return [ticket, ...list.filter(c => c.chatExternalId !== event.chatExternalId)];
        });
      })
    );

  }

  // Silent background refresh — never toggles the page-level `loading` signal, so it
  // doesn't blank the table or show a full-page loader while the main list stays put.
  private loadQueueTickets(): void {
    this.service.getClientTicketsQueue()
      .pipe(
        map(res => [...res.data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())),
        catchError(() => of([])),
      )
      .subscribe(sorted => {
        this.customerQueueTickets.set(sorted.map(t => this.service.mapClientTicketToComplaint(t)));
      });
  }

  visibleComplaints = computed(() => {
    const tab = this.activeTab();
    if (tab === 'hosts')    return this.hostTickets();
    if (tab === 'resolved') return this.resolvedTickets();
    return this.customerDisplayTickets();
  });

  private loadTabData(tab: ComplaintTab): void {
    this.loading.set(true);
    if (tab === 'hosts') {
      this.loadHostTickets();
    } else if (tab === 'resolved') {
      this.loadResolvedTickets();
    } else if (tab === 'customers') {
      this.loadClientTickets();
    }
  }

  private loadHostFilterSources(): void {
    this.service.getPropertiesForFilter().subscribe({
      next: properties => this.hostProperties.set(Array.isArray(properties) ? properties : []),
      error: () => { /* property filter simply stays empty if this call fails */ },
    });
    this.service.getAssignableEmployees(undefined, 1, 50).subscribe({
      next: page => this.hostEmployees.set(Array.isArray(page?.data) ? page.data : []),
      error: () => { /* assigned-employee filter simply stays empty if this call fails */ },
    });
  }

  private loadHostTickets(): void {
    this.loading.set(true);
    this.hostError.set(false);
    this.service.getTickets({
      propertyId: this.hostPropertyId() ?? undefined,
      assignedAdminUserId: this.hostAssignedAdminUserId() ?? undefined,
      search: this.hostSearch() || undefined,
      page: this.hostPage(),
      pageSize: HOST_TICKETS_PAGE_SIZE,
    })
      .pipe(
        map(res => ({
          complaints: res.data.map(t => this.service.mapTicketToComplaint(t)),
          totalCount: res.totalCount,
          totalPages: res.totalPages,
        })),
        catchError(() => {
          this.hostError.set(true);
          return of(null);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe(res => {
        if (!res) return; // keep the previous list/filters on screen when the request fails
        this.hostTickets.set(res.complaints);
        this.hostTotalCount.set(res.totalCount);
        this.hostTotalPages.set(res.totalPages);
      });
  }

  onHostSearchInput(term: string): void {
    this.hostSearchSubject.next(term);
  }

  private applyHostSearch(term: string): void {
    this.hostSearch.set(term.trim());
    this.hostPage.set(1);
    this.loadHostTickets();
  }

  /** Single handler for the unified property/employee dropdown bar. */
  onHostFiltersChange(filters: Record<string, string>): void {
    this.hostPropertyId.set(filters['property'] && filters['property'] !== 'all' ? Number(filters['property']) : null);
    this.hostAssignedAdminUserId.set(filters['employee'] && filters['employee'] !== 'all' ? filters['employee'] : null);
    this.hostPage.set(1);
    this.loadHostTickets();
  }

  onHostPageChange(page: number): void {
    this.hostPage.set(page);
    this.loadHostTickets();
  }

  retryLoadHostTickets(): void {
    this.loadHostTickets();
  }

  resetHostFilters(): void {
    this.hostSearch.set('');
    this.hostPropertyId.set(null);
    this.hostAssignedAdminUserId.set(null);
    this.hostPage.set(1);
    this.loadHostTickets();
  }

  private loadResolvedTickets(): void {
    this.loading.set(true);
    this.service.getResolvedTicketsOverview({
      type: this.resolvedType() ?? undefined,
      search: this.resolvedSearch() || undefined,
      page: this.resolvedPage(),
      pageSize: RESOLVED_TICKETS_PAGE_SIZE,
    })
      .pipe(
        map(res => ({
          complaints: res.data.map(item => this.service.mapTicketsOverviewItemToComplaint(item)),
          totalCount: res.totalCount,
          totalPages: res.totalPages,
        })),
        catchError(() => {
          this.toastr.error(this.translate.instant('d3.toast.errorOp'));
          return of({ complaints: [], totalCount: 0, totalPages: 1 });
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe(res => {
        this.resolvedTickets.set(res.complaints);
        this.resolvedTotalCount.set(res.totalCount);
        this.resolvedTotalPages.set(res.totalPages);
      });
  }

  onResolvedSearchChange(term: string): void {
    this.resolvedSearch.set(term);
    this.resolvedPage.set(1);
    this.loadResolvedTickets();
  }

  onResolvedPageChange(page: number): void {
    this.resolvedPage.set(page);
    this.loadResolvedTickets();
  }

  onResolvedTypeChange(type: number | string | null): void {
    this.resolvedType.set(type as 'Client' | 'Merchant' | null);
    this.resolvedPage.set(1);
    this.loadResolvedTickets();
  }

  private loadClientTickets(): void {
    this.loading.set(true);
    this.service.getClientTickets({
      status: this.customerStatus() ?? undefined,
      search: this.customerSearch() || undefined,
      page: this.customerPage(),
      pageSize: CLIENT_TICKETS_PAGE_SIZE,
    })
      .pipe(
        map(res => ({
          complaints: res.data
            .filter(t => t.status !== 'Closed')
            .map(t => this.service.mapClientTicketToComplaint(t)),
          totalCount: res.totalCount,
          totalPages: res.totalPages,
        })),
        catchError(() => {
          this.toastr.error(this.translate.instant('d3.toast.errorOp'));
          return of({ complaints: [], totalCount: 0, totalPages: 1 });
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe(res => {
        this.customerAllTickets.set(res.complaints);
        this.customerTotalCount.set(res.totalCount);
        this.customerTotalPages.set(res.totalPages);
      });
  }

  onCustomerSearchChange(term: string): void {
    this.customerSearch.set(term);
    this.customerPage.set(1);
    this.loadClientTickets();
  }

  onCustomerStatusChange(status: number | string | null): void {
    this.customerStatus.set(status as number | null);
    this.customerPage.set(1);
    this.loadClientTickets();
  }

  onCustomerPageChange(page: number): void {
    this.customerPage.set(page);
    this.loadClientTickets();
  }

  setTab(tab: ComplaintTab): void {
    this.activeTab.set(tab);
    this.selectedComplaint.set(null);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab, openTicket: null, type: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.loadTabData(tab);
  }

  onRowSelect(complaint: Complaint): void {
    if (this.activeTab() === 'hosts') return;

    // Resolved host complaints go to the detail page as view
    if (this.activeTab() === 'resolved' && complaint.type === 'host') {
      this.openHostComplaint(complaint);
      return;
    }

    const current = this.selectedComplaint();
    if (current?.id === complaint.id) {
      this.selectedComplaint.set(null);
      return;
    }

    this.selectedComplaint.set(complaint);
    if (complaint.type === 'customer') {
      this.loadClientTicketDetail(complaint);
    }
  }

  private loadClientTicketDetail(complaint: Complaint): void {
    if (complaint.type !== 'customer') return;

    if (!complaint.chatExternalId) {
      // Defensive fallback — every row from the list carries chatExternalId today,
      // but don't leave the chat unopenable if a row somehow doesn't.
      this.service.getClientTicketById(complaint.id).subscribe({
        next: detail => {
          if (this.selectedComplaint()?.id !== complaint.id) return;
          this.selectedComplaint.set(this.service.mapClientTicketDetailToComplaint(detail, complaint));
        },
        error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp')),
      });
      return;
    }

    this.service.getClientChatById(complaint.chatExternalId).subscribe({
      next: chat => {
        if (this.selectedComplaint()?.id !== complaint.id) return;
        this.selectedComplaint.set(this.service.mapClientChatToComplaint(chat, complaint));
      },
      error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp')),
    });
  }

  // The table already performed the assignTicket call and shown the success/error toast —
  // this just reflects the new assignee in the in-memory lists so the row updates in place.
  onAssignConfirm({ complaintId, employee }: { complaintId: string; employee: AssignableEmployee }): void {
    const patch = (list: Complaint[]) => list.map(c =>
      c.id === complaintId
        ? { ...c, assignedAdminUserId: employee.userId, assignedAdminName: employee.fullName }
        : c
    );
    this.customerAllTickets.update(patch);
    this.customerQueueTickets.update(patch);
    this.hostTickets.update(patch);

    if (this.selectedComplaint()?.id === complaintId) {
      this.selectedComplaint.update(c => c && { ...c, assignedAdminUserId: employee.userId, assignedAdminName: employee.fullName });
    }
  }

  // The chat already made the claim call — this reflects the new assignee in the in-memory
  // lists and drops the ticket out of the priority Queue immediately, without waiting on the
  // background refresh below (kept for cases another ticket became claimable/requeued too).
  onTicketClaimed({ complaintId, agentUserId, agentName }: { complaintId: string; agentUserId: string; agentName: string }): void {
    const patch = (list: Complaint[]) => list.map(c =>
      c.id === complaintId
        ? { ...c, assignedAdminUserId: agentUserId, assignedAdminName: agentName }
        : c
    );
    this.customerAllTickets.update(patch);
    this.customerQueueTickets.update(list => list.filter(c => c.id !== complaintId));

    if (this.selectedComplaint()?.id === complaintId) {
      this.selectedComplaint.update(c => c && { ...c, assignedAdminUserId: agentUserId, assignedAdminName: agentName });
    }

    this.loadQueueTickets();
  }

  openHostComplaint(complaint: Complaint): void {
    const queryParams = this.activeTab() === 'resolved'
      ? { mode: 'view', tab: 'resolved' }
      : { tab: 'hosts' };
    this.router.navigate(
      [this.translate.currentLang || 'ar', 'd3', 'complaints', complaint.id],
      { queryParams }
    );
  }

  onResolve(complaint: Complaint): void {
    if (this.selectedComplaint()?.id === complaint.id) {
      this.selectedComplaint.set(null);
    }
    // The status update already happened server-side (chat component calls the API
    // before emitting resolve) — just drop it from the active customers list here.
    this.customerAllTickets.update(list => list.filter(c => c.id !== complaint.id));
    this.customerQueueTickets.update(list => list.filter(c => c.id !== complaint.id));
    this.customerTotalCount.update(count => (count !== null ? Math.max(0, count - 1) : count));
  }

  closeChat(): void {
    this.selectedComplaint.set(null);
  }

  get chatOpen(): boolean {
    return this.selectedComplaint() !== null;
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }
}
