import { Component, inject, signal, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { ComplaintService } from '../../services/complaint.service';
import { TicketAttachment, TicketDetail, TicketMessage } from '../../interfaces/complaint.model';
import { PageTitleOverrideService } from '../../../../services/page-title-override.service';
import { LoginService } from '../../../../services/login/login.service';

@Component({
  selector: 'app-host-complaint-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './host-complaint-detail.component.html',
  styleUrl: './host-complaint-detail.component.scss'
})
export class HostComplaintDetailComponent implements OnInit, OnDestroy {
  private translate = inject(TranslateService);
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private service   = inject(ComplaintService);
  private pageTitleOverride = inject(PageTitleOverrideService);
  private loginService = inject(LoginService);
  private toastr = inject(ToastrService);

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
          this.pageTitleOverride.set(detail.subject);
        },
        error: () => {
          this.loading.set(false);
          this.toastr.error(this.translate.instant('d3.toast.errorOp'));
        },
      });
    } else {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.pageTitleOverride.clear();
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
    if (!bytes) return `0 ${this.translate.instant('d3.complaints.hostDetail.kb')}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ${this.translate.instant('d3.complaints.hostDetail.kb')}`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} ${this.translate.instant('d3.complaints.hostDetail.mb')}`;
  }

  isImageAttachment(contentType: string | null | undefined): boolean {
    return !!contentType && contentType.startsWith('image/');
  }

  getFileIcon(contentType: string | null | undefined): string {
    if (!contentType) return 'file';
    if (contentType.startsWith('image/')) return 'photo';
    if (contentType === 'application/pdf') return 'file-type-pdf';
    if (contentType.includes('word') || contentType === 'application/msword') return 'file-type-doc';
    if (contentType.includes('sheet') || contentType === 'application/vnd.ms-excel') return 'file-type-xls';
    if (contentType.startsWith('video/')) return 'video';
    return 'file';
  }

  /** Swaps a broken image thumbnail for the generic file icon instead of leaving a broken-image box. */
  onThumbnailError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  openAttachment(att: TicketAttachment | null | undefined): void {
    if (!att?.fileUrl) {
      this.toastr.error(this.translate.instant('d3.complaints.hostDetail.fileUnavailable'));
      return;
    }
    window.open(att.fileUrl, '_blank', 'noopener,noreferrer');
  }

  /** Top-level `attachments` can legitimately repeat a file already shown under the
   * initial message or a reply (older data / previous mapping) — filter those out by
   * externalId so nothing is shown twice on the page. */
  legacyAttachments(ticket: TicketDetail): TicketAttachment[] {
    const shownIds = new Set<string>();
    if (ticket.initialMessage?.attachment?.externalId) {
      shownIds.add(ticket.initialMessage.attachment.externalId);
    }
    for (const m of ticket.messages ?? []) {
      if (m?.attachment?.externalId) shownIds.add(m.attachment.externalId);
    }
    return (ticket.attachments ?? []).filter(a => a && !shownIds.has(a.externalId));
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
    this.assignToCurrentUserIfUnassigned().then(() => {
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
    });
  }

  /** Assigns the ticket to the current user only when they actually reply — merely
   * viewing the ticket must not claim it and lock out reassignment. */
  private assignToCurrentUserIfUnassigned(): Promise<void> {
    const t = this.ticket();
    if (!t || t.assignedAdminUserId) return Promise.resolve();
    const user = this.loginService.getUser();
    if (!user?.userId) return Promise.resolve();

    return new Promise(resolve => {
      this.service.assignTicket(this.ticketId, user.userId).subscribe({
        next: () => {
          this.ticket.update(curr =>
            curr ? { ...curr, assignedAdminUserId: user.userId, assignedAdminName: user.fullName } : curr
          );
          resolve();
        },
        error: () => resolve(),
      });
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
