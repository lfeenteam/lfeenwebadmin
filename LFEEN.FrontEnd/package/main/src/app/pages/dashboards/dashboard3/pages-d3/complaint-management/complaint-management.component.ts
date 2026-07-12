import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, catchError, finalize, map, of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ComplaintTabsBarComponent } from './components/complaint-tabs-bar/complaint-tabs-bar.component';
import { ComplaintsTableComponent } from './components/complaints-table/complaints-table.component';
import { ComplaintChatComponent } from './components/complaint-chat/complaint-chat.component';
import { ComplaintService } from './services/complaint.service';
import { CLIENT_TICKETS_PAGE_SIZE, CLIENT_TICKET_STATUS_OPTIONS, Complaint, ComplaintTab, HOST_TICKETS_PAGE_SIZE, HOST_TICKET_STATUS_OPTIONS, RESOLVED_TICKETS_PAGE_SIZE, RESOLVED_TYPE_OPTIONS } from './interfaces/complaint.model';
import { ClientSupportHubService } from '../../services/client-support-hub.service';

@Component({
  selector: 'app-complaint-management',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    TablerIconsModule,
    ComplaintTabsBarComponent,
    ComplaintsTableComponent,
    ComplaintChatComponent,
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

  activeTab         = signal<ComplaintTab>('customers');
  selectedComplaint = signal<Complaint | null>(null);
  loading           = signal(false);

  private resolvedTickets = signal<Complaint[]>([]);

  readonly clientStatusOptions = CLIENT_TICKET_STATUS_OPTIONS;
  customerTickets     = signal<Complaint[]>([]);
  customerTotalCount  = signal<number | null>(null);
  customerTotalPages  = signal(1);
  customerPage        = signal(1);
  customerSearch      = signal('');
  customerStatus      = signal<number | null>(null);

  readonly hostStatusOptions = HOST_TICKET_STATUS_OPTIONS;
  hostTickets     = signal<Complaint[]>([]);
  hostTotalCount  = signal<number | null>(null);
  hostTotalPages  = signal(1);
  hostPage        = signal(1);
  hostSearch      = signal('');
  hostStatus      = signal<number | null>(null);

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
    this.watchLiveUpdates();

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

    this.service.getClientTicketById(id).subscribe({
      next: detail => this.selectedComplaint.set(this.service.mapClientTicketDetailToComplaint(detail)),
      error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp')),
    });
  }

  ngOnDestroy(): void {
    this.hubSubs.unsubscribe();
  }

  private watchLiveUpdates(): void {
    this.hubSubs.add(
      this.hub.newClientTicket$.subscribe(event => {
        if (this.activeTab() !== 'customers' || this.customerPage() !== 1) return;
        if (this.customerSearch() || this.customerStatus() !== null) return;
        const complaint: Complaint = {
          id: event.ticketExternalId,
          ticketId: event.ticketNumber,
          clientName: '-',
          clientInitials: '-',
          clientCode: '-',
          status: 'new',
          date: new Date(event.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }),
          dateEn: new Date(event.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
          type: 'customer',
          resolved: false,
          messages: [],
          subject: event.subject,
        };
        this.customerTickets.update(list => [complaint, ...list]);
        this.customerTotalCount.update(count => (count ?? 0) + 1);
      })
    );

    this.hubSubs.add(
      this.hub.newClientMessage$.subscribe(event => {
        this.customerTickets.update(list => {
          const ticket = list.find(c => c.id === event.ticketExternalId);
          if (!ticket) return list;
          return [ticket, ...list.filter(c => c.id !== event.ticketExternalId)];
        });
      })
    );

  }

  visibleComplaints = computed(() => {
    const tab = this.activeTab();
    if (tab === 'hosts')    return this.hostTickets();
    if (tab === 'resolved') return this.resolvedTickets();
    return this.customerTickets();
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

  private loadHostTickets(): void {
    this.loading.set(true);
    this.service.getTickets({
      status: this.hostStatus() ?? undefined,
      search: this.hostSearch() || undefined,
      page: this.hostPage(),
      pageSize: HOST_TICKETS_PAGE_SIZE,
    })
      .pipe(
        map(res => ({
          complaints: res.data
            .filter(t => t.status !== 5 && t.status !== 'Closed')
            .map(t => this.service.mapTicketToComplaint(t)),
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
        this.hostTickets.set(res.complaints);
        this.hostTotalCount.set(res.totalCount);
        this.hostTotalPages.set(res.totalPages);
      });
  }

  onHostSearchChange(term: string): void {
    this.hostSearch.set(term);
    this.hostPage.set(1);
    this.loadHostTickets();
  }

  onHostStatusChange(status: number | string | null): void {
    this.hostStatus.set(status as number | null);
    this.hostPage.set(1);
    this.loadHostTickets();
  }

  onHostPageChange(page: number): void {
    this.hostPage.set(page);
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
        this.customerTickets.set(res.complaints);
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

    this.service.getClientTicketById(complaint.id).subscribe({
      next: detail => {
        if (this.selectedComplaint()?.id !== complaint.id) return;
        this.selectedComplaint.set(this.service.mapClientTicketDetailToComplaint(detail, complaint));
      },
      error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp')),
    });
  }

  onAssignClick(complaint: Complaint): void {
    const lang = this.translate.currentLang || 'ar';
    this.router.navigate([lang, 'd3', 'complaints', complaint.id, 'assign'], {
      // Also carried as a query param (not just router state) so the assign page can
      // still tell customer and host tickets apart after a hard reload, when router
      // state is gone — otherwise it falls back to assuming 'customer' and calls the
      // wrong ticket-detail endpoint for a host ticket id.
      queryParams: { type: complaint.type, tab: this.activeTab() },
      state: {
        ticketNumber: complaint.ticketId,
        complaintType: complaint.type,
        assignedAdminUserId: complaint.assignedAdminUserId ?? null,
        assignedAdminName: complaint.assignedAdminName ?? null,
      }
    });
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
    this.customerTickets.update(list => list.filter(c => c.id !== complaint.id));
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
