import { AfterViewChecked, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ChatMessage, Complaint } from '../../interfaces/complaint.model';
import { ComplaintService } from '../../services/complaint.service';
import { ClientSupportHubService, NewMessageEvent } from '../../../../services/client-support-hub.service';

@Component({
  selector: 'app-complaint-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './complaint-chat.component.html',
  styleUrl: './complaint-chat.component.scss'
})
export class ComplaintChatComponent implements OnChanges, OnDestroy, AfterViewChecked {
  @Input() complaint!: Complaint;
  @Input() viewOnly = false;
  @Output() close = new EventEmitter<void>();
  @Output() resolve = new EventEmitter<void>();

  @ViewChild('messagesEnd') private messagesEnd!: ElementRef;

  private service = inject(ComplaintService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private hub = inject(ClientSupportHubService);
  private hubSubs = new Subscription();
  private ticketScopedSubs = new Subscription();

  messageText = '';
  sending = signal(false);
  clientOnline = signal(false);
  clientTyping = signal(false);
  private shouldScroll = false;
  private lastTypingEmitAt = 0;

  constructor() {
    // newMessage$ carries its own ticketExternalId, so it's safe to keep subscribed
    // for the component's whole lifetime and filter inside the handler.
    this.hubSubs.add(
      this.hub.newMessage$.subscribe(event => this.onIncomingMessage(event))
    );
  }

  private subscribeTicketScopedEvents(): void {
    // typingIndicator$/ticketStatusChanged$/participantOnline$/participantOffline$ carry
    // no ticket id (they're scoped implicitly to whichever room the connection is
    // currently joined to). Re-creating these subscriptions fresh on every ticket switch
    // — instead of keeping one long-lived subscription for the component's lifetime —
    // means we simply aren't listening at all during a switch, so a stale event for the
    // ticket we just left can't be misattributed to the ticket we just opened.
    this.ticketScopedSubs = new Subscription();
    this.ticketScopedSubs.add(
      this.hub.typingIndicator$.subscribe(event => {
        if (event.isAgent) return;
        this.clientTyping.set(event.isTyping);
      })
    );
    this.ticketScopedSubs.add(
      this.hub.ticketStatusChanged$.subscribe(event => {
        if (!this.complaint) return;
        this.complaint = {
          ...this.complaint,
          status: this.service.mapClientTicketStatus(event.status),
          resolved: event.status === 'Resolved' || event.status === 'Closed',
        };
      })
    );
    this.ticketScopedSubs.add(
      this.hub.participantOnline$.subscribe(event => {
        if (!event.isAgent) this.clientOnline.set(true);
      })
    );
    this.ticketScopedSubs.add(
      this.hub.participantOffline$.subscribe(event => {
        if (!event.isAgent) this.clientOnline.set(false);
      })
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.shouldScroll = true;

    const complaintChange = changes['complaint'];
    if (complaintChange) {
      const previousId = complaintChange.previousValue?.id;
      const currentId = complaintChange.currentValue?.id;
      if (previousId !== currentId) {
        this.ticketScopedSubs.unsubscribe();
        this.clientOnline.set(false);
        this.clientTyping.set(false);

        const leave = previousId ? this.hub.leaveTicket(previousId) : Promise.resolve();
        leave.then(() => {
          if (!currentId) return;
          return this.hub.joinTicket(currentId).then(() => this.subscribeTicketScopedEvents());
        });
      }
    }
  }

  ngOnDestroy(): void {
    this.hub.leaveTicket(this.complaint?.id);
    this.hubSubs.unsubscribe();
    this.ticketScopedSubs.unsubscribe();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private onIncomingMessage(event: NewMessageEvent): void {
    if (!this.complaint || event.ticketExternalId !== this.complaint.id) return;
    if (this.complaint.messages.some(m => m.id === event.messageExternalId)) return;

    const createdAt = new Date(event.sentAt);
    const message: ChatMessage = {
      id: event.messageExternalId,
      senderRole: event.senderType === 'Client' ? 'client' : 'support',
      senderName: event.senderName,
      content: event.body,
      timestamp: createdAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      timestampEn: createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      attachment: event.attachment
        ? { fileName: event.attachment.fileName, url: event.attachment.url, contentType: event.attachment.contentType }
        : null,
    };

    this.shouldScroll = true;
    this.complaint = { ...this.complaint, messages: [...this.complaint.messages, message] };
  }

  onResolve(): void {
    this.resolve.emit();
  }

  goToAssignPage(): void {
    const lang = this.translate.currentLang || 'ar';
    this.router.navigate([lang, 'd3', 'complaints', this.complaint.id, 'assign'], {
      state: {
        ticketNumber: this.complaint.ticketId,
        complaintType: this.complaint.type,
        assignedAdminUserId: this.complaint.assignedAdminUserId ?? null,
        assignedAdminName: this.complaint.assignedAdminName ?? null,
      }
    });
  }

  send(): void {
    const text = this.messageText.trim();
    if (!text || this.sending()) return;

    this.messageText = '';
    this.hub.sendTyping(this.complaint.id, false);

    // Don't append the message locally — the Hub's NewMessage event renders it,
    // so every open tab/agent (including this one) stays in sync with one source of truth.
    this.sending.set(true);
    this.service.sendClientTicketMessage(this.complaint.id, text)
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        error: () => {
          // Restore what the agent typed — a failed send shouldn't lose their message.
          this.messageText = text;
          this.toastr.error(this.translate.instant('d3.toast.errorOp'));
        },
      });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  onComposerInput(): void {
    if (this.viewOnly || !this.complaint) return;
    const now = Date.now();
    if (now - this.lastTypingEmitAt < 2000) return;
    this.lastTypingEmitAt = now;
    this.hub.sendTyping(this.complaint.id, true);
  }

  onComposerBlur(): void {
    if (this.viewOnly || !this.complaint) return;
    this.hub.sendTyping(this.complaint.id, false);
  }

  getEmployeeInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase();
  }

  get avatarColor(): string {
    const colors = ['teal', 'blue', 'orange', 'purple', 'green'];
    const code = (this.complaint?.clientInitials ?? 'A').charCodeAt(0);
    return colors[code % colors.length];
  }

  get displayClientName(): string {
    return this.translate.currentLang === 'en'
      ? this.complaint.clientNameEn ?? this.complaint.clientName
      : this.complaint.clientName;
  }

  get dateSeparatorLabel(): string {
    return this.translate.currentLang === 'en' ? 'Today - 9:10 AM' : 'اليوم - ٩:١٠ ص';
  }

  get resolveButtonLabel(): string {
    return this.translate.currentLang === 'en' ? 'Close and resolve complaint' : 'إغلاق وحل الشكوى';
  }

  get composerPlaceholder(): string {
    return this.translate.currentLang === 'en' ? 'Write to him here...' : 'اكتب له هنا...';
  }

  get canSend(): boolean {
    return !!this.messageText.trim();
  }

  isImageAttachment(attachment: { contentType: string }): boolean {
    return attachment.contentType.startsWith('image/');
  }

  displayMessageContent(message: ChatMessage): string {
    return this.translate.currentLang === 'en'
      ? message.contentEn ?? message.content
      : message.content;
  }

  displayMessageTime(message: ChatMessage): string {
    return this.translate.currentLang === 'en'
      ? message.timestampEn ?? message.timestamp
      : message.timestamp;
  }

  private scrollToBottom(): void {
    try {
      this.messagesEnd?.nativeElement.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }
}
