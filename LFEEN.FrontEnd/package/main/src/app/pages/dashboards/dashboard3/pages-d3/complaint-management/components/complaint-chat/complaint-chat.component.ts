import { AfterViewChecked, Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ChatMessage, Complaint } from '../../interfaces/complaint.model';
import { ComplaintService } from '../../services/complaint.service';

@Component({
  selector: 'app-complaint-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './complaint-chat.component.html',
  styleUrl: './complaint-chat.component.scss'
})
export class ComplaintChatComponent implements OnChanges, AfterViewChecked {
  @Input() complaint!: Complaint;
  @Input() viewOnly = false;
  @Output() close = new EventEmitter<void>();
  @Output() resolve = new EventEmitter<void>();

  @ViewChild('messagesEnd') private messagesEnd!: ElementRef;
  @ViewChild('fileInput') private fileInput!: ElementRef<HTMLInputElement>;

  private service = inject(ComplaintService);
  private translate = inject(TranslateService);

  messageText = '';
  selectedAttachments: File[] = [];
  private shouldScroll = false;

  ngOnChanges(): void {
    this.shouldScroll = true;
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  onResolve(): void {
    this.resolve.emit();
  }

  send(): void {
    const text = this.messageText.trim();
    if (!text && !this.selectedAttachments.length) return;

    const attachmentLabel = this.translate.instant('d3.complaints.chat.attachmentLabel');
    const attachmentText = this.selectedAttachments.length
      ? `\n${this.selectedAttachments.map(file => `${attachmentLabel}: ${file.name}`).join('\n')}`
      : '';

    this.messageText = '';
    this.selectedAttachments = [];
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }

    const content = `${text}${attachmentText}`.trim();
    this.shouldScroll = true;
    this.appendLocalMessage(content);
    this.service.sendMessage(this.complaint.id, content).subscribe();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
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
    return !!this.messageText.trim() || this.selectedAttachments.length > 0;
  }

  openAttachmentPicker(): void {
    this.fileInput?.nativeElement.click();
  }

  onAttachmentChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.selectedAttachments = [...this.selectedAttachments, ...files];
  }

  removeAttachment(index: number): void {
    this.selectedAttachments = this.selectedAttachments.filter((_, i) => i !== index);
    if (!this.selectedAttachments.length && this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
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

  private appendLocalMessage(content: string): void {
    const message: ChatMessage = {
      id: `local-${Date.now()}`,
      senderRole: 'support',
      senderName: this.translate.instant('d3.complaints.chat.supportName'),
      content,
      timestamp: new Date().toLocaleTimeString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-SA', {
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    this.complaint = {
      ...this.complaint,
      messages: [...this.complaint.messages, message]
    };
  }
}
