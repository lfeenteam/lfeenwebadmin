import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, catchError, finalize, map, of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ComplaintTabsBarComponent } from './components/complaint-tabs-bar/complaint-tabs-bar.component';
import { ComplaintsTableComponent } from './components/complaints-table/complaints-table.component';
import { ComplaintChatComponent } from './components/complaint-chat/complaint-chat.component';
import { ComplaintService } from './services/complaint.service';
import { CLIENT_TICKETS_PAGE_SIZE, CLIENT_TICKET_STATUS_OPTIONS, Complaint, ComplaintTab, RESOLVED_TICKETS_PAGE_SIZE } from './interfaces/complaint.model';
import { ClientSupportHubService } from '../../services/client-support-hub.service';

@Component({
  selector: 'app-complaint-management',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
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

  private hostTickets    = signal<Complaint[]>([]);
  private resolvedTickets = signal<Complaint[]>([]);

  readonly clientStatusOptions = CLIENT_TICKET_STATUS_OPTIONS;
  customerTickets     = signal<Complaint[]>([]);
  customerTotalCount  = signal<number | null>(null);
  customerTotalPages  = signal(1);
  customerPage        = signal(1);
  customerSearch      = signal('');
  customerStatus      = signal<number | null>(null);

  resolvedTotalCount  = signal<number | null>(null);
  resolvedTotalPages  = signal(1);
  resolvedPage        = signal(1);
  resolvedSearch      = signal('');

  constructor() {
    const tab = this.route.snapshot.queryParamMap.get('tab') as ComplaintTab | null;
    if (tab === 'customers' || tab === 'hosts' || tab === 'resolved') {
      this.activeTab.set(tab);
    }
    this.loadTabData(this.activeTab());
    this.watchLiveUpdates();

    const openTicketId = this.route.snapshot.queryParamMap.get('openTicket');
    if (openTicketId) {
      this.openTicketById(openTicketId);
    }
  }

  private openTicketById(id: string): void {
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

    this.hubSubs.add(
      this.hub.ticketAssigned$.subscribe(event => {
        this.toastr.info(`${event.ticketNumber} · ${event.subject}`, this.translate.instant('d3.complaints.chat.assign.assignedToYou'));
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
      this.service.getTickets()
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe(tickets => this.hostTickets.set(tickets.filter(t => t.status !== 'closed')));
    } else if (tab === 'resolved') {
      this.loadResolvedTickets();
    } else if (tab === 'customers') {
      this.loadClientTickets();
    }
  }

  private loadResolvedTickets(): void {
    this.loading.set(true);
    this.service.getResolvedTicketsOverview({
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
          complaints: res.data.map(t => this.service.mapClientTicketToComplaint(t)),
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

  onCustomerStatusChange(status: number | null): void {
    this.customerStatus.set(status);
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
    this.service.getClientTicketById(complaint.id).subscribe({
      next: detail => {
        if (this.selectedComplaint()?.id !== complaint.id) return;
        this.selectedComplaint.set(this.service.mapClientTicketDetailToComplaint(detail, complaint));
      },
      error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp')),
    });
  }

  openHostComplaint(complaint: Complaint): void {
    const queryParams = this.activeTab() === 'resolved' ? { mode: 'view' } : {};
    this.router.navigate(
      [this.translate.currentLang || 'ar', 'd3', 'complaints', complaint.id],
      { queryParams }
    );
  }

  onResolve(complaint: Complaint): void {
    if (this.selectedComplaint()?.id === complaint.id) {
      this.selectedComplaint.set(null);
    }
    this.service.resolveComplaint(complaint.id).subscribe();
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
