import { Component, inject, signal, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ComplaintService } from '../../services/complaint.service';
import { TicketAttachment, TicketDetail, TicketMessage } from '../../interfaces/complaint.model';

@Component({
  selector: 'app-host-complaint-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './host-complaint-detail.component.html',
  styleUrl: './host-complaint-detail.component.scss'
})
export class HostComplaintDetailComponent implements OnInit {
  private translate = inject(TranslateService);
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private service   = inject(ComplaintService);

  replyText       = '';
  closeNote       = '';
  loading         = signal(true);
  sendingReply    = signal(false);
  showCloseDialog = signal(false);
  closingTicket   = signal(false);
  closeError      = signal<string | null>(null);
  ticket          = signal<TicketDetail | null>(null);

  private ticketId = '';

  readonly viewOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';

  private lastTrigger = this.service.closeDialogTrigger();

  constructor() {
    effect(() => {
      const n = this.service.closeDialogTrigger();
      if (n > this.lastTrigger) {
        this.lastTrigger = n;
        this.openCloseDialog();
      }
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.ticketId = id;
      this.service.getTicketById(id).subscribe({
        next: detail => {
          this.ticket.set(detail);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.loading.set(false);
    }
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(
      this.currentDir === 'rtl' ? 'ar-SA' : 'en-US',
      { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    );
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  get adminMessages(): TicketMessage[] {
    return (this.ticket()?.messages ?? []).filter(
      m => m != null && (m.senderTypeName === 'Admin' || m.senderType === 'Admin' || +m.senderType === 2)
    );
  }

  get hostSubtitle(): string {
    const t = this.ticket();
    if (!t) return '';
    const role = this.currentDir === 'rtl' ? 'مضيف' : 'Host';
    return t.propertyName ? `${role} · ${t.propertyName}` : role;
  }

  get lastUpdateDate(): string {
    const t = this.ticket();
    if (!t) return '';
    const all = [t.initialMessage, ...t.messages];
    const last = all[all.length - 1];
    return this.formatDate(last.createdAt);
  }

  trackById(_: number, item: TicketAttachment | TicketMessage): string {
    return item.externalId;
  }

  sendReply(): void {
    const body = this.replyText.trim();
    if (!body || this.sendingReply()) return;

    this.sendingReply.set(true);
    this.service.sendTicketReply(this.ticketId, body).subscribe({
      next: result => {
        this.replyText = '';
        const newMsg = result?.reply ?? null;
        if (newMsg) {
          this.ticket.update(t =>
            t ? { ...t, messages: [...t.messages, newMsg] } : t
          );
          this.sendingReply.set(false);
        } else {
          this.service.getTicketById(this.ticketId).subscribe({
            next: detail => {
              this.ticket.set(detail);
              this.sendingReply.set(false);
            },
            error: () => this.sendingReply.set(false),
          });
        }
      },
      error: () => this.sendingReply.set(false),
    });
  }

  openCloseDialog(): void {
    this.closeError.set(null);
    this.showCloseDialog.set(true);
  }

  cancelClose(): void {
    this.showCloseDialog.set(false);
    this.closeNote  = '';
    this.closeError.set(null);
  }

  confirmClose(): void {
    if (this.closingTicket()) return;
    this.closingTicket.set(true);
    this.closeError.set(null);
    this.service.updateTicketStatus(this.ticketId, '5', this.closeNote.trim() || undefined).subscribe({
      next: () => {
        this.closingTicket.set(false);
        this.showCloseDialog.set(false);
        this.router.navigate(['../'], {
          relativeTo: this.route,
          queryParams: { tab: 'resolved' },
        });
      },
      error: () => {
        this.closingTicket.set(false);
        this.closeError.set('حدث خطأ أثناء إغلاق الشكوى، يرجى المحاولة مرة أخرى.');
      },
    });
  }
}
