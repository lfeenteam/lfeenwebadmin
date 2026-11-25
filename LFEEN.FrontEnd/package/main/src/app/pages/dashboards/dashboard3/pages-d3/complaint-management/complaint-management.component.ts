import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ComplaintTabsBarComponent } from './components/complaint-tabs-bar/complaint-tabs-bar.component';
import { ComplaintsTableComponent } from './components/complaints-table/complaints-table.component';
import { ComplaintChatComponent } from './components/complaint-chat/complaint-chat.component';
import { ClientRatingsComponent } from './components/client-ratings/client-ratings.component';
import { TabsFilterComponent, BuildFilterOption } from '../all-builds/tabs-filter/tabs-filter.component';
import { ComplaintService } from './services/complaint.service';
import { AssignableEmployee, CLIENT_TICKETS_PAGE_SIZE, CLIENT_TICKET_DEPARTMENT_OPTIONS, CLIENT_TICKET_PRIORITY_OPTIONS, CLIENT_TICKET_STATUS_OPTIONS, Complaint, ComplaintTab, HOST_TICKETS_PAGE_SIZE, HOST_TICKET_DEPARTMENT_OPTIONS, HOST_TICKET_PRIORITY_OPTIONS, HOST_TICKET_SOURCE_OPTIONS, HOST_TICKET_STATUS_OPTIONS, RESOLVED_TICKETS_PAGE_SIZE, RESOLVED_TYPE_OPTIONS, TicketPropertyFilterItem, TicketSource } from './interfaces/complaint.model';
import { ClientSupportHubService } from '../../services/client-support-hub.service';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';

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
    ClientRatingsComponent,
    TabsFilterComponent,
    DashboardEmptyComponent,
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
  private customerSearchSub?: Subscription;
  private customerSearchSubject = new Subject<string>();
  private langSub?: Subscription;
  private openTicketSub?: Subscription;

  // One load stream per list: switchMap cancels the in-flight request whenever a newer
  // search/page/filter load starts, so a slow stale response can never overwrite the
  // results of the latest one.
  /** Emits `silent`: true = background refresh (no loader, keep the list on failure). */
  private clientLoad$   = new Subject<boolean>();
  private hostLoad$     = new Subject<void>();
  private resolvedLoad$ = new Subject<void>();
  private listLoadSubs  = new Subscription();

  private currentLangSignal = signal(this.translate.currentLang || this.translate.defaultLang || 'ar');

  activeTab         = signal<ComplaintTab>('customers');
  selectedComplaint = signal<Complaint | null>(null);
  loading           = signal(false);

  private resolvedTickets = signal<Complaint[]>([]);

  readonly clientStatusOptions = CLIENT_TICKET_STATUS_OPTIONS;
  // customerAllTickets: one server page of OPEN tickets from GET /api/client-tickets?isOpen=true.
  // Filtering is server-side only — never drop rows here, or the page stops matching
  // totalCount/totalPages. customerDisplayTickets (below) only reorders within the page.
  customerAllTickets  = signal<Complaint[]>([]);
  customerTotalCount  = signal<number | null>(null);
  customerTotalPages  = signal(1);
  customerPage        = signal(1);
  customerSearch      = signal('');
  customerStatus      = signal<string | null>(null);
  customerDepartment  = signal<string | null>(null);
  customerPriority    = signal<string | null>(null);
  customerAssignedAgentUserId = signal<string | null>(null);

  readonly clientDepartmentOptions = CLIENT_TICKET_DEPARTMENT_OPTIONS;
  readonly clientPriorityOptions   = CLIENT_TICKET_PRIORITY_OPTIONS;

  // Tickets waiting for an agent float to the top of the current page. Reordering only —
  // never adds rows from elsewhere, so the row count always equals the server page.
  customerDisplayTickets = computed<Complaint[]>(() => {
    const all = this.customerAllTickets();
    return [
      ...all.filter(c => c.status === 'pending'),
      ...all.filter(c => c.status !== 'pending'),
    ];
  });

  hostTickets     = signal<Complaint[]>([]);
  hostTotalCount  = signal<number | null>(null);
  hostTotalPages  = signal(1);
  hostPage        = signal(1);
  hostSearch      = signal('');
  hostPropertyId  = signal<number | null>(null);
  hostAssignedAdminUserId = signal<string | null>(null);
  hostStatus      = signal<string | null>(null);
  hostDepartment  = signal<string | null>(null);
  hostPriority    = signal<string | null>(null);
  /** Host app vs service (worker) app — sent to GET /api/tickets as `source`. */
  hostSource      = signal<TicketSource | null>(null);
  hostError       = signal(false);
  customerError   = signal(false);
  resolvedError   = signal(false);

  readonly hostStatusOptions     = HOST_TICKET_STATUS_OPTIONS;
  readonly hostDepartmentOptions = HOST_TICKET_DEPARTMENT_OPTIONS;
  readonly hostPriorityOptions   = HOST_TICKET_PRIORITY_OPTIONS;
  readonly hostSourceOptions   = HOST_TICKET_SOURCE_OPTIONS;

  hostProperties  = signal<TicketPropertyFilterItem[]>([]);
  hostEmployees   = signal<AssignableEmployee[]>([]);

  hostHasActiveFilters = computed(() =>
    !!this.hostSearch() ||
    this.hostPropertyId() !== null ||
    this.hostAssignedAdminUserId() !== null ||
    this.hostStatus() !== null ||
    this.hostDepartment() !== null ||
    this.hostPriority() !== null ||
    this.hostSource() !== null
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
        id: 'status',
        labelKey: 'd3.complaints.table.allStatuses',
        items: [allItem('d3.complaints.table.allStatuses'), ...this.hostStatusOptions],
      },
      {
        id: 'department',
        labelKey: 'd3.complaints.hostFilters.allDepartments',
        items: [allItem('d3.complaints.hostFilters.allDepartments'), ...this.hostDepartmentOptions],
      },
      {
        id: 'source',
        labelKey: 'd3.complaints.hostFilters.source.all',
        items: [allItem('d3.complaints.hostFilters.source.all'), ...this.hostSourceOptions],
      },
      {
        id: 'priority',
        labelKey: 'd3.complaints.hostFilters.allPriorities',
        items: [allItem('d3.complaints.hostFilters.allPriorities'), ...this.hostPriorityOptions],
      },
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
    status: this.hostStatus() ?? 'all',
    department: this.hostDepartment() ?? 'all',
    priority: this.hostPriority() ?? 'all',
    source: this.hostSource() ?? 'all',
    property: this.hostPropertyId() !== null ? String(this.hostPropertyId()) : 'all',
    employee: this.hostAssignedAdminUserId() ?? 'all',
  }));

  /** Same unified bar for the customers tab — status / department / priority / assigned-agent,
   * all sent straight to GET /api/client-tickets as the API's string enum names. Reuses the
   * hostEmployees list (loaded in loadHostFilterSources) for the assigned-agent dropdown. */
  readonly customerFilterOptions = computed<BuildFilterOption[]>(() => {
    const allItem = (labelKey: string) => ({ value: 'all', labelKey });
    return [
      {
        id: 'status',
        labelKey: 'd3.complaints.table.allStatuses',
        items: [allItem('d3.complaints.table.allStatuses'), ...this.clientStatusOptions],
      },
      {
        id: 'department',
        labelKey: 'd3.complaints.hostFilters.allDepartments',
        items: [allItem('d3.complaints.hostFilters.allDepartments'), ...this.clientDepartmentOptions],
      },
      {
        id: 'priority',
        labelKey: 'd3.complaints.hostFilters.allPriorities',
        items: [allItem('d3.complaints.hostFilters.allPriorities'), ...this.clientPriorityOptions],
      },
      {
        id: 'agent',
        labelKey: 'd3.complaints.hostFilters.allEmployees',
        items: [
          allItem('d3.complaints.hostFilters.allEmployees'),
          ...(Array.isArray(this.hostEmployees()) ? this.hostEmployees() : [])
            .map(e => ({ value: e.userId, labelKey: e.fullName })),
        ],
      },
    ];
  });

  readonly customerActiveFiltersSnapshot = computed<Record<string, string>>(() => ({
    status: this.customerStatus() ?? 'all',
    department: this.customerDepartment() ?? 'all',
    priority: this.customerPriority() ?? 'all',
    agent: this.customerAssignedAgentUserId() ?? 'all',
  }));

  readonly resolvedTypeOptions = RESOLVED_TYPE_OPTIONS;
  resolvedTotalCount  = signal<number | null>(null);
  resolvedTotalPages  = signal(1);
  resolvedPage        = signal(1);
  resolvedSearch      = signal('');
  resolvedType        = signal<'Client' | 'Merchant' | null>(null);

  constructor() {
    const tab = this.route.snapshot.queryParamMap.get('tab') as ComplaintTab | null;
    if (tab === 'customers' || tab === 'hosts' || tab === 'resolved' || tab === 'ratings') {
      this.activeTab.set(tab);
    }
    this.watchListLoads();
    this.loadTabData(this.activeTab());
    this.watchLiveUpdates();
    this.loadHostFilterSources();

    this.hostSearchSub = this.hostSearchSubject
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(term => this.applyHostSearch(term));

    this.customerSearchSub = this.customerSearchSubject
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(term => this.applyCustomerSearch(term));

    // departmentName/statusName/priorityName come back from the API already localized
    // based on the Accept-Language header, so a lang switch needs a refetch of the active
    // tab to pick up the new language — the same pattern all-bookings/all-units use.
    this.langSub = this.translate.onLangChange.subscribe(({ lang }) => {
      this.currentLangSignal.set(lang);
      this.loadTabData(this.activeTab());
      this.loadHostFilterSources();
    });

    // Subscribed, not a one-off snapshot read: the FAB deep-links here via query params, and
    // when the user is already on this page Angular reuses this component instance (same
    // route, only query params change) — a snapshot read in the constructor would never see
    // the new ticket id, so clicking another chat would just land back on the normal page.
    this.openTicketSub = this.route.queryParamMap.subscribe(params => {
      const openTicketId = params.get('openTicket');
      if (!openTicketId) return;
      const ticketType = params.get('type');
      const inferredType: Complaint['type'] =
        ticketType === 'host' || this.activeTab() === 'hosts' ? 'host' : 'customer';
      this.openTicketById(openTicketId, inferredType);
    });
  }

  // exactSession: show this session's own thread straight from the ticket detail instead of
  // resolving the chat. A rated session is always closed and the client may have opened newer
  // ones since — the chat endpoint maps to its *current* session, and only that one is
  // guaranteed to carry messages, so going through it shows the wrong (or an empty) thread.
  private openTicketById(id: string, type: Complaint['type'], exactSession = false): void {
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
        if (exactSession) {
          this.selectedComplaint.set({ ...fallback, hasMoreMessages: ticket.hasMoreMessages ?? false });
          return;
        }
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
    this.listLoadSubs.unsubscribe();
    this.hostSearchSub?.unsubscribe();
    this.customerSearchSub?.unsubscribe();
    this.langSub?.unsubscribe();
    this.openTicketSub?.unsubscribe();
  }

  private watchLiveUpdates(): void {
    // NewClientTicket/SessionEscalated/Claimed/Released/Resolved only tell us *that* something
    // changed, not the full row data — so they just trigger a silent refetch of the current
    // open-tickets page (new/requeued tickets appear, resolved ones drop out, counts stay true).
    this.hubSubs.add(
      this.hub.newClientTicket$.subscribe(() => this.refreshClientTicketsSilently())
    );

    this.hubSubs.add(
      this.hub.sessionEscalated$.subscribe(() => this.refreshClientTicketsSilently())
    );

    this.hubSubs.add(
      this.hub.sessionClaimed$.subscribe(() => this.refreshClientTicketsSilently())
    );

    this.hubSubs.add(
      this.hub.agentReleased$.subscribe(event => {
        if (event.requeued) this.refreshClientTicketsSilently();
      })
    );

    this.hubSubs.add(
      this.hub.sessionResolved$.subscribe(() => this.refreshClientTicketsSilently())
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
  // doesn't blank the table or show a full-page loader. Only while the customers tab is
  // on screen; switching to it reloads anyway.
  private refreshClientTicketsSilently(): void {
    if (this.activeTab() !== 'customers' || this.loading()) return;
    this.clientLoad$.next(true);
  }

  visibleComplaints = computed(() => {
    const tab = this.activeTab();
    if (tab === 'hosts')    return this.hostTickets();
    if (tab === 'resolved') return this.resolvedTickets();
    return this.customerDisplayTickets();
  });

  private loadTabData(tab: ComplaintTab): void {
    // The ratings tab is a self-contained component that loads its own data.
    if (tab === 'ratings') {
      this.loading.set(false);
      return;
    }
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
    // All pages, not just the first — a single page of 50 silently dropped everyone after it.
    this.service.getAllAssignableEmployees().subscribe({
      next: employees => this.hostEmployees.set(employees),
      error: () => { /* assigned-employee filter simply stays empty if this call fails */ },
    });
  }

  /** Wires the three list load streams. Params are read from the signals inside switchMap so
   * each request uses the latest search/page/filters; catchError sits on the inner request so a
   * failure never kills the stream. `loading` is cleared only when the latest request settles —
   * a cancelled stale request no longer flips it off while the newer one is still in flight. */
  private watchListLoads(): void {
    this.listLoadSubs.add(
      this.clientLoad$.pipe(
        tap(silent => {
          if (silent) return;
          this.loading.set(true);
          this.customerError.set(false);
        }),
        switchMap(silent => this.service.getClientTickets({
          // Work queue: open tickets only, filtered by the server so every page is full
          // and totalCount/totalPages count exactly what this tab can show.
          isOpen: true,
          status: this.customerStatus() ?? undefined,
          department: this.customerDepartment() ?? undefined,
          priority: this.customerPriority() ?? undefined,
          assignedAgentUserId: this.customerAssignedAgentUserId() ?? undefined,
          search: this.customerSearch() || undefined,
          page: this.customerPage(),
          pageSize: CLIENT_TICKETS_PAGE_SIZE,
        }).pipe(
          map(res => ({
            complaints: res.data.map(t => this.service.mapClientTicketToComplaint(t)),
            totalCount: res.totalCount,
            totalPages: res.totalPages,
          })),
          catchError(() => {
            // A failed background refresh keeps the current list as-is.
            if (silent) return of(null);
            // Inline error + retry instead of a toast over an empty "no complaints" table.
            this.customerError.set(true);
            return of({ complaints: [] as Complaint[], totalCount: 0, totalPages: 1 });
          }),
        )),
      ).subscribe(res => {
        if (!res) return;
        // The last item on the last page was resolved by a refresh — step back a page.
        if (res.complaints.length === 0 && res.totalCount > 0 && res.totalPages < this.customerPage()) {
          this.customerPage.set(Math.max(1, res.totalPages));
          this.clientLoad$.next(false);
          return;
        }
        this.customerAllTickets.set(res.complaints);
        this.customerTotalCount.set(res.totalCount);
        this.customerTotalPages.set(res.totalPages);
        this.loading.set(false);
      })
    );

    this.listLoadSubs.add(
      this.hostLoad$.pipe(
        tap(() => { this.loading.set(true); this.hostError.set(false); }),
        switchMap(() => this.service.getTickets({
          propertyId: this.hostPropertyId() ?? undefined,
          assignedAdminUserId: this.hostAssignedAdminUserId() ?? undefined,
          status: this.hostStatus() ?? undefined,
          department: this.hostDepartment() ?? undefined,
          priority: this.hostPriority() ?? undefined,
          source: this.hostSource() ?? undefined,
          search: this.hostSearch() || undefined,
          page: this.hostPage(),
          pageSize: HOST_TICKETS_PAGE_SIZE,
        }).pipe(
          map(res => ({
            complaints: res.data.map(t => this.service.mapTicketToComplaint(t)),
            totalCount: res.totalCount,
            totalPages: res.totalPages,
          })),
          catchError(() => {
            this.hostError.set(true);
            return of(null);
          }),
        )),
      ).subscribe(res => {
        this.loading.set(false);
        if (!res) return; // keep the previous list/filters on screen when the request fails
        this.hostTickets.set(res.complaints);
        this.hostTotalCount.set(res.totalCount);
        this.hostTotalPages.set(res.totalPages);
      })
    );

    this.listLoadSubs.add(
      this.resolvedLoad$.pipe(
        tap(() => { this.loading.set(true); this.resolvedError.set(false); }),
        switchMap(() => this.service.getResolvedTicketsOverview({
          type: this.resolvedType() ?? undefined,
          search: this.resolvedSearch() || undefined,
          page: this.resolvedPage(),
          pageSize: RESOLVED_TICKETS_PAGE_SIZE,
        }).pipe(
          map(res => ({
            complaints: res.data.map(item => this.service.mapTicketsOverviewItemToComplaint(item)),
            totalCount: res.totalCount,
            totalPages: res.totalPages,
          })),
          catchError(() => {
            // Inline error + retry instead of a toast over an empty "no complaints" table.
            this.resolvedError.set(true);
            return of({ complaints: [] as Complaint[], totalCount: 0, totalPages: 1 });
          }),
        )),
      ).subscribe(res => {
        this.resolvedTickets.set(res.complaints);
        this.resolvedTotalCount.set(res.totalCount);
        this.resolvedTotalPages.set(res.totalPages);
        this.loading.set(false);
      })
    );
  }

  private loadHostTickets(): void {
    this.hostLoad$.next();
  }

  onHostSearchInput(term: string): void {
    this.hostSearchSubject.next(term);
  }

  private applyHostSearch(term: string): void {
    this.hostSearch.set(term.trim());
    this.hostPage.set(1);
    this.loadHostTickets();
  }

  /** Single handler for the unified status/department/priority/property/employee dropdown bar. */
  onHostFiltersChange(filters: Record<string, string>): void {
    const norm = (v: string | undefined) => (v && v !== 'all' ? v : null);
    this.hostStatus.set(norm(filters['status']));
    this.hostDepartment.set(norm(filters['department']));
    this.hostPriority.set(norm(filters['priority']));
    const source = filters['source'];
    this.hostSource.set(source === 'HostApp' || source === 'ServiceApp' ? source : null);
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

  /** The customers/resolved list failed to load — shown as error + retry, not "no complaints". */
  readonly listLoadError = computed(() =>
    (this.activeTab() === 'customers' && this.customerError()) ||
    (this.activeTab() === 'resolved' && this.resolvedError()));

  retryLoadActiveTab(): void {
    this.loadTabData(this.activeTab());
  }

  resetHostFilters(): void {
    this.hostSearch.set('');
    this.hostPropertyId.set(null);
    this.hostAssignedAdminUserId.set(null);
    this.hostStatus.set(null);
    this.hostDepartment.set(null);
    this.hostPriority.set(null);
    this.hostSource.set(null);
    this.hostPage.set(1);
    this.loadHostTickets();
  }

  private loadResolvedTickets(): void {
    this.resolvedLoad$.next();
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
    this.clientLoad$.next(false);
  }

  onCustomerSearchChange(term: string): void {
    this.customerSearch.set(term);
    this.customerPage.set(1);
    this.loadClientTickets();
  }

  onCustomerSearchInput(term: string): void {
    this.customerSearchSubject.next(term);
  }

  private applyCustomerSearch(term: string): void {
    this.customerSearch.set(term.trim());
    this.customerPage.set(1);
    this.loadClientTickets();
  }

  onCustomerStatusChange(status: number | string | null): void {
    this.customerStatus.set(status != null ? String(status) : null);
    this.customerPage.set(1);
    this.loadClientTickets();
  }

  /** Single handler for the unified customers filter bar (status / department / priority / agent). */
  onCustomerFiltersChange(filters: Record<string, string>): void {
    const norm = (v: string | undefined) => (v && v !== 'all' ? v : null);
    this.customerStatus.set(norm(filters['status']));
    this.customerDepartment.set(norm(filters['department']));
    this.customerPriority.set(norm(filters['priority']));
    this.customerAssignedAgentUserId.set(norm(filters['agent']));
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
    // assignedAtUtc restarts the delay clock, so a stalled ticket that was just
    // reassigned doesn't still show as delayed for the new assignee.
    const assignment = { assignedAdminUserId: employee.userId, assignedAdminName: employee.fullName, assignedAtUtc: new Date().toISOString() };
    const patch = (list: Complaint[]) => list.map(c => c.id === complaintId ? { ...c, ...assignment } : c);
    this.customerAllTickets.update(patch);
    this.hostTickets.update(patch);

    if (this.selectedComplaint()?.id === complaintId) {
      this.selectedComplaint.update(c => c && { ...c, ...assignment });
    }
  }

  // The assignee changed since the list loaded — refetch so the row shows who really has it.
  onAssignConflict(): void {
    this.loadTabData(this.activeTab());
  }

  // The chat already made the claim call — this reflects the new assignee (and status) in
  // the in-memory list right away; the silent refresh then syncs the page with the server.
  onTicketClaimed({ complaintId, agentUserId, agentName }: { complaintId: string; agentUserId: string; agentName: string }): void {
    const assignment = { assignedAdminUserId: agentUserId, assignedAdminName: agentName, assignedAtUtc: new Date().toISOString() };
    const patch = (list: Complaint[]) => list.map(c =>
      c.id === complaintId ? { ...c, ...assignment, status: c.status === 'pending' ? 'in_progress' as const : c.status } : c);
    this.customerAllTickets.update(patch);

    if (this.selectedComplaint()?.id === complaintId) {
      this.selectedComplaint.update(c => c && { ...c, ...assignment });
    }

    this.refreshClientTicketsSilently();
  }

  openHostComplaint(complaint: Complaint): void {
    // A finished ticket opens read-only from any tab, so the header never offers
    // "Close & resolve" on it (the detail page also checks the status itself).
    const finished = complaint.status === 'closed' || complaint.status === 'resolved';
    const queryParams = this.activeTab() === 'resolved'
      ? { mode: 'view', tab: 'resolved' }
      : finished ? { mode: 'view', tab: 'hosts' } : { tab: 'hosts' };
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
    this.customerTotalCount.update(count => (count !== null ? Math.max(0, count - 1) : count));
    // Pull the next open ticket up so the page stays full and the page count stays true.
    this.refreshClientTicketsSilently();
  }

  // Opens the rated session's chat read-only next to the ratings list. The rating's
  // sessionExternalId is the client ticket id; clicking the open one again closes it.
  onRatingOpenSession(sessionExternalId: string): void {
    if (this.selectedComplaint()?.id === sessionExternalId) {
      this.selectedComplaint.set(null);
      return;
    }
    this.openTicketById(sessionExternalId, 'customer', true);
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
