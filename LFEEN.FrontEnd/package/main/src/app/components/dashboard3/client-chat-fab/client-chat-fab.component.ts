import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Subscription, catchError, of } from 'rxjs';
import { ComplaintService } from 'src/app/pages/dashboards/dashboard3/pages-d3/complaint-management/services/complaint.service';
import { ClientSupportHubService } from 'src/app/pages/dashboards/dashboard3/services/client-support-hub.service';
import { Complaint } from 'src/app/pages/dashboards/dashboard3/pages-d3/complaint-management/interfaces/complaint.model';
import { ComplaintChatComponent } from 'src/app/pages/dashboards/dashboard3/pages-d3/complaint-management/components/complaint-chat/complaint-chat.component';

// Global floating action button (all d3 pages) surfacing the customer-support "Help
// Center" panel — a short list of active (non-closed) customer chats. Opening an item
// loads the chat inline, right here in the floating panel, instead of navigating away
// to the complaints page.
@Component({
  selector: 'app-client-chat-fab',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule, ComplaintChatComponent],
  templateUrl: './client-chat-fab.component.html',
  styleUrl: './client-chat-fab.component.scss',
})
export class ClientChatFabComponent implements OnInit, OnDestroy {
  private service = inject(ComplaintService);
  private hub = inject(ClientSupportHubService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private hubSubs = new Subscription();

  panelOpen = signal(false);
  loading = signal(false);
  activeChats = signal<Complaint[]>([]);
  selectedTicket = signal<Complaint | null>(null);
  openingTicketId = signal<string | null>(null);

  readonly badgeCount = computed(() => this.activeChats().length);
  readonly badgeText = computed(() => (this.badgeCount() > 9 ? '9+' : String(this.badgeCount())));

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  ngOnInit(): void {
    this.loadActiveChats();
    this.watchLiveUpdates();
  }

  ngOnDestroy(): void {
    this.hubSubs.unsubscribe();
  }

  private watchLiveUpdates(): void {
    // Any of these can change the active-conversations list — refresh on each.
    this.hubSubs.add(this.hub.newClientTicket$.subscribe(() => this.loadActiveChats()));
    this.hubSubs.add(this.hub.sessionEscalated$.subscribe(() => this.loadActiveChats()));
    this.hubSubs.add(this.hub.sessionClaimed$.subscribe(() => this.loadActiveChats()));
    this.hubSubs.add(this.hub.sessionResolved$.subscribe(() => this.loadActiveChats()));
    this.hubSubs.add(this.hub.newClientMessage$.subscribe(() => this.loadActiveChats()));
    this.hubSubs.add(
      this.hub.agentReleased$.subscribe(event => {
        if (event.requeued) this.loadActiveChats();
      })
    );
  }

  private loadActiveChats(): void {
    this.loading.set(true);
    this.service
      .getClientTickets({ page: 1, pageSize: 15 })
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        this.loading.set(false);
        if (!res) return;
        const active = res.data
          .filter(t => !['Closed', 'ClosedByClient', 'ClosedByAdmin'].includes(t.status))
          .sort((a, b) => {
            const aTime = new Date(a.lastMessageAtUtc ?? a.createdAt).getTime();
            const bTime = new Date(b.lastMessageAtUtc ?? b.createdAt).getTime();
            return bTime - aTime;
          })
          .slice(0, 10);
        this.activeChats.set(active.map(t => this.service.mapClientTicketToComplaint(t)));
      });
  }

  togglePanel(): void {
    const opening = !this.panelOpen();
    this.panelOpen.set(opening);
    if (opening) {
      this.selectedTicket.set(null);
      this.loadActiveChats();
    }
  }

  closePanel(): void {
    this.panelOpen.set(false);
    this.selectedTicket.set(null);
    this.openingTicketId.set(null);
  }

  statusLabelKey(status: Complaint['status']): string {
    const map: Record<string, string> = {
      new: 'd3.complaints.status.new',
      in_progress: 'd3.complaints.status.inProgress',
      closed: 'd3.complaints.status.closed',
      pending: 'd3.complaints.status.pending',
      replied: 'd3.complaints.status.replied',
    };
    return map[status] ?? '';
  }

  // 'new'/'pending' — nobody has replied yet, so both the dot and the pill stay in the
  // more urgent (dark/green) treatment; everything already being worked gets the neutral one.
  isUrgent(status: Complaint['status']): boolean {
    return status === 'new' || status === 'pending';
  }

  formatListTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const locale = this.translate.currentLang === 'en' ? 'en-US' : 'ar-SA';

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return this.translate.instant('d3.chatFab.yesterday');
    }

    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  }

  initials(name: string | null | undefined): string {
    return (name ?? '')
      .split(' ')
      .slice(0, 2)
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase();
  }

  // Loads the full chat thread inline and swaps the panel over to it — the ticket list's
  // getClientTickets() only carries summary fields, not the message thread, so the detail
  // (and then the richer chat-level view, which has the full history incl. the bot phase)
  // has to be fetched before the chat can be shown.
  openTicket(ticket: Complaint): void {
    if (this.openingTicketId()) return;
    this.openingTicketId.set(ticket.id);
    this.service.getClientTicketById(ticket.id).subscribe({
      next: detail => {
        const fallback = this.service.mapClientTicketDetailToComplaint(detail);
        if (!detail.chatExternalId) {
          this.openingTicketId.set(null);
          this.selectedTicket.set(fallback);
          return;
        }
        this.service.getClientChatById(detail.chatExternalId).subscribe({
          next: chat => {
            this.openingTicketId.set(null);
            this.selectedTicket.set(this.service.mapClientChatToComplaint(chat, fallback));
          },
          error: () => {
            this.openingTicketId.set(null);
            this.selectedTicket.set(fallback);
          },
        });
      },
      error: () => this.openingTicketId.set(null),
    });
  }

  backToList(): void {
    this.selectedTicket.set(null);
    this.loadActiveChats();
  }

  openAllChats(): void {
    this.closePanel();
    this.router.navigate([this.translate.currentLang || 'ar', 'd3', 'complaints'], {
      queryParams: { tab: 'customers' },
    });
  }
}
