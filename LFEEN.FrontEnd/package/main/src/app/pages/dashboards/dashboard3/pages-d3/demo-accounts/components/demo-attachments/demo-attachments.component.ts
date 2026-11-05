import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { DemoAccountsService } from '../../../../services/demo-accounts.service';
import { DEMO_ATTACHMENT_LIMITS, DemoAttachment, attachmentSize } from '../../../../interfaces/demo-account.model';
import { demoErrorMessage, demoFileIcon, formatFileSize, readDemoError } from '../../demo-accounts.util';

interface AttachmentItem {
  /** Set once the upload returned; missing while it runs. */
  id?: string;
  fileName: string;
  contentType: string;
  size: number;
}

// The email invitation file picker (§5.3), shared by create and resend.
// Files upload as soon as they are chosen (one request per pick, never retried);
// removing a file only drops its id. The parent reads `ids`, `uploading` and `touched`.
@Component({
  selector: 'app-demo-attachments',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './demo-attachments.component.html',
  styleUrl: './demo-attachments.component.scss'
})
export class DemoAttachmentsComponent implements OnInit, OnDestroy {
  private readonly service = inject(DemoAccountsService);
  private readonly translate = inject(TranslateService);

  /** Files already saved on the account (resend). */
  @Input() initial: DemoAttachment[] = [];
  @Input() disabled = false;
  @Input() inputId = 'da-attachments';

  readonly limits = DEMO_ATTACHMENT_LIMITS;
  readonly fileSize = formatFileSize;
  readonly fileIcon = demoFileIcon;

  items: AttachmentItem[] = [];
  error: string | null = null;
  uploading = false;
  /** True once the admin added or removed a file. */
  touched = false;

  private upload?: Subscription;

  ngOnInit(): void {
    this.items = this.initial.map(a => ({
      id: a.id, fileName: a.fileName, contentType: a.contentType, size: attachmentSize(a),
    }));
  }

  ngOnDestroy(): void {
    this.upload?.unsubscribe();
  }

  get ids(): string[] {
    return this.items.filter(i => i.id).map(i => i.id!);
  }

  get totalSize(): number {
    return this.items.reduce((sum, i) => sum + i.size, 0);
  }

  get full(): boolean {
    return this.items.length >= DEMO_ATTACHMENT_LIMITS.maxCount;
  }

  /** Shows a server error (create/resend) under the picker. */
  setError(message: string | null): void {
    this.error = message;
  }

  onPick(input: HTMLInputElement): void {
    const picked = Array.from(input.files ?? []);
    input.value = ''; // the same file can be picked again after removing it
    if (!picked.length || this.disabled || this.uploading) return;

    this.error = this.validate(picked);
    if (this.error) return;

    const pending: AttachmentItem[] = picked.map(f => ({ fileName: f.name, contentType: f.type, size: f.size }));
    this.items = [...this.items, ...pending];
    this.touched = true;
    this.uploading = true;

    this.upload = this.service.uploadAttachments(picked).subscribe({
      next: uploaded => {
        this.uploading = false;
        // The server answers in the order the files were sent.
        uploaded.forEach((a, i) => {
          const item = pending[i];
          if (!item) return;
          item.id = a.id;
          item.fileName = a.fileName || item.fileName;
          item.contentType = a.contentType || item.contentType;
          item.size = attachmentSize(a) || item.size;
        });
        // Anything the server did not return is dropped.
        this.items = this.items.filter(i => !pending.includes(i) || i.id);
      },
      error: err => {
        this.uploading = false;
        this.items = this.items.filter(i => !pending.includes(i));
        const e = readDemoError(err);
        this.error = demoErrorMessage(e, this.translate);
      },
    });
  }

  remove(index: number): void {
    if (this.disabled || this.uploading) return;
    this.items = this.items.filter((_, i) => i !== index);
    this.touched = true;
    this.error = null;
  }

  private validate(picked: File[]): string | null {
    const t = (key: string) => this.translate.instant(`d3.demoAccounts.validation.${key}`);
    const exts = DEMO_ATTACHMENT_LIMITS.extensions as readonly string[];

    const bad = picked.find(f => !exts.includes('.' + (f.name.split('.').pop() ?? '').toLowerCase()));
    if (bad) return `${t('attachmentType')} (${bad.name})`;
    const empty = picked.find(f => f.size === 0);
    if (empty) return `${t('attachmentEmpty')} (${empty.name})`;
    if (this.items.length + picked.length > DEMO_ATTACHMENT_LIMITS.maxCount) return t('attachmentsCount');
    const total = this.totalSize + picked.reduce((s, f) => s + f.size, 0);
    if (total > DEMO_ATTACHMENT_LIMITS.maxTotalBytes) return t('attachmentsSize');
    return null;
  }
}
