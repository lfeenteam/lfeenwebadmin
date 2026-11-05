import { Component, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { DemoAccountsService } from '../../../../services/demo-accounts.service';
import {
  DEMO_CHANNELS,
  DEMO_CHANNEL_ICONS,
  DEMO_EMAIL_PATTERN,
  DEMO_LIMITS,
  DemoAccountCredentials,
  DemoChannel,
  SAUDI_MOBILE_PATTERN,
  isStrongDemoPin,
  normalizePhoneInput,
  toLocalPhone
} from '../../../../interfaces/demo-account.model';
import {
  DEMO_FIELD_ALIASES,
  demoErrorMessage,
  demoFileIcon,
  formatRiyadhDate,
  isNoAnswerError,
  newIdempotencyKey,
  readDemoError
} from '../../demo-accounts.util';
import { DemoAttachmentsComponent } from '../demo-attachments/demo-attachments.component';

export type CreateDemoDialogResult =
  | { type: 'created'; credentials: DemoAccountCredentials; /** What the admin typed for the chosen channel. */ recipient: string }
  | { type: 'duplicate'; fullName: string }
  | { type: 'disabled' };

type CreateField = 'fullName' | 'channel' | 'email' | 'phoneNumber' | 'subject' | 'durationDays' | 'pin' | 'note';

const FIELDS: CreateField[] = ['fullName', 'channel', 'email', 'phoneNumber', 'subject', 'durationDays', 'pin', 'note'];

@Component({
  selector: 'app-create-demo-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, DemoAttachmentsComponent],
  templateUrl: './create-demo-dialog.component.html',
  styleUrl: './create-demo-dialog.component.scss'
})
export class CreateDemoDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CreateDemoDialogComponent, CreateDemoDialogResult>);
  private readonly service = inject(DemoAccountsService);
  private readonly translate = inject(TranslateService);
  private readonly toastr = inject(ToastrService);

  @ViewChild(DemoAttachmentsComponent) private attachments?: DemoAttachmentsComponent;

  readonly channels = DEMO_CHANNELS;
  readonly channelIcons = DEMO_CHANNEL_ICONS;
  readonly limits = DEMO_LIMITS;

  fullName = '';
  channel: DemoChannel = 'Email';
  email = '';
  phoneNumber = '';
  /** Email only (§4); empty = the default subject. Kept when switching channels. */
  subject = '';
  durationDays: number | null = DEMO_LIMITS.defaultDays;
  pin = '';
  note = '';
  showPin = false;

  submitting = false;
  formError: string | null = null;
  errors: Partial<Record<CreateField, string | null>> = {};
  private readonly touched = new Set<CreateField>();
  private demoDisabled = false;

  // Generated when the form opens; replaced after any answer the admin has to act on (§6.2).
  private idempotencyKey = newIdempotencyKey();

  get isEmail(): boolean { return this.channel === 'Email'; }
  get emailRequired(): boolean { return this.isEmail; }
  get phoneRequired(): boolean { return !this.isEmail; }

  /** Submit stays off while files are uploading (§5.3). */
  get uploading(): boolean { return !!this.attachments?.uploading; }

  // ── Live preview (approximate — the server writes the real invitation text) ──
  readonly fileIcon = demoFileIcon;
  private readonly lang = this.translate.currentLang || 'ar';

  get previewFiles(): { fileName: string; contentType: string }[] {
    return this.attachments?.items ?? [];
  }

  get previewName(): string {
    return this.fullName.trim() || this.translate.instant('d3.demoAccounts.create.preview.sampleName');
  }

  get previewDays(): number {
    const d = Number(this.durationDays);
    return Number.isInteger(d) && d > 0 ? d : DEMO_LIMITS.defaultDays;
  }

  get previewExpiry(): string {
    return formatRiyadhDate(new Date(Date.now() + this.previewDays * 86_400_000), this.lang) ?? '';
  }

  get previewRecipient(): string {
    if (this.isEmail) return this.email.trim() || 'example@mail.com';
    return toLocalPhone(normalizePhoneInput(this.phoneNumber)) || '05XXXXXXXX';
  }

  setChannel(channel: DemoChannel): void {
    if (this.submitting || channel === this.channel) return;
    this.channel = channel;
    // The other fields keep their values; only the required star moves.
    this.revalidate(['email', 'phoneNumber', 'subject']);
  }

  onBlur(field: CreateField): void {
    this.touched.add(field);
    this.errors[field] = this.validate(field);
  }

  onInput(field: CreateField): void {
    if (this.touched.has(field)) this.errors[field] = this.validate(field);
  }

  // Digits only; the input is rewritten so pasted spaces/letters don't linger on screen.
  onPinInput(value: string, input: HTMLInputElement): void {
    this.pin = (value ?? '').replace(/\D/g, '').slice(0, 6);
    if (input.value !== this.pin) input.value = this.pin;
    this.onInput('pin');
  }

  stepDays(delta: number): void {
    const current = Number(this.durationDays) || DEMO_LIMITS.defaultDays;
    this.durationDays = Math.min(DEMO_LIMITS.maxDays, Math.max(DEMO_LIMITS.minDays, current + delta));
    this.onBlur('durationDays');
  }

  cancel(): void {
    if (this.submitting) return;
    this.dialogRef.close(this.demoDisabled ? { type: 'disabled' } : undefined);
  }

  submit(): void {
    if (this.submitting || this.uploading) return;
    FIELDS.forEach(f => this.touched.add(f));
    this.revalidate(FIELDS);
    this.formError = null;
    if (FIELDS.some(f => this.errors[f])) return;

    const phone = normalizePhoneInput(this.phoneNumber);
    const fullName = this.fullName.trim();
    const subject = this.subject.trim();
    const attachmentIds = this.attachments?.ids ?? [];
    this.submitting = true;
    this.attachments?.setError(null);

    this.service.create({
      fullName,
      email: this.email.trim() || null,
      phoneNumber: phone || null,
      channel: this.channel,
      durationDays: Number(this.durationDays),
      pin: this.pin || null,
      note: this.note.trim() || null,
      // Subject and files are for Email only — never sent for WhatsApp/SMS (§5.3).
      ...(this.isEmail && subject ? { invitationSubject: subject } : {}),
      ...(this.isEmail && attachmentIds.length ? { attachmentIds } : {}),
    }, this.idempotencyKey).subscribe({
      next: credentials => {
        this.submitting = false;
        const recipient = this.isEmail ? this.email.trim() : (toLocalPhone(phone) ?? phone);
        this.dialogRef.close({ type: 'created', credentials, recipient });
      },
      error: err => {
        this.submitting = false;
        const e = readDemoError(err);

        // No answer reached the browser → the same key is safe for the retry; any
        // real answer means the next submit is a new request.
        if (!isNoAnswerError(e)) this.idempotencyKey = newIdempotencyKey();

        if (e.code === 'DEMO_REQUEST_DUPLICATE') {
          this.toastr.warning(demoErrorMessage(e, this.translate));
          this.dialogRef.close({ type: 'duplicate', fullName });
          return;
        }

        if (e.code === 'DEMO_DISABLED') this.demoDisabled = true;

        if (e.code === 'PIN_TOO_WEAK') {
          this.errors.pin = demoErrorMessage(e, this.translate);
          return;
        }

        // DEMO_ATTACHMENTS_TOO_LARGE / DEMO_ATTACHMENT_INVALID → under the file picker.
        if (e.code?.startsWith('DEMO_ATTACHMENT')) {
          this.attachments?.setError(demoErrorMessage(e, this.translate));
          return;
        }

        if (e.code === 'VALIDATION_ERROR' && e.fieldErrors.length) {
          const unplaced: string[] = [];
          for (const fe of e.fieldErrors) {
            const name = fe.field ? (DEMO_FIELD_ALIASES[fe.field] ?? fe.field) : null;
            if (name === 'attachments') { this.attachments?.setError(fe.message); continue; }
            const field = FIELDS.find(f => f.toLowerCase() === name);
            if (field) this.errors[field] = fe.message;
            else unplaced.push(fe.message);
          }
          this.formError = unplaced.length ? unplaced.join(' - ') : null;
          return;
        }

        // Includes DEMO_SAMPLE_CATALOG_MISSING: nothing was saved, the form stays as it is.
        this.formError = demoErrorMessage(e, this.translate);
      },
    });
  }

  private revalidate(fields: CreateField[]): void {
    for (const f of fields) {
      if (this.touched.has(f)) this.errors[f] = this.validate(f);
    }
  }

  private validate(field: CreateField): string | null {
    const t = (key: string) => this.translate.instant(`d3.demoAccounts.validation.${key}`);

    switch (field) {
      case 'fullName': {
        const v = this.fullName.trim();
        if (!v) return t('fullNameRequired');
        return v.length > DEMO_LIMITS.fullName ? t('fullNameMax') : null;
      }
      case 'email': {
        const v = this.email.trim();
        if (!v) return this.emailRequired ? t('emailRequired') : null;
        return v.length > DEMO_LIMITS.email || !DEMO_EMAIL_PATTERN.test(v) ? t('emailInvalid') : null;
      }
      case 'phoneNumber': {
        const v = normalizePhoneInput(this.phoneNumber);
        if (!v) return this.phoneRequired ? t('phoneRequired') : null;
        return SAUDI_MOBILE_PATTERN.test(v) ? null : t('phoneInvalid');
      }
      case 'subject':
        return this.isEmail ? validateInvitationSubject(this.subject, t) : null;
      case 'durationDays': {
        const v = Number(this.durationDays);
        return Number.isInteger(v) && v >= DEMO_LIMITS.minDays && v <= DEMO_LIMITS.maxDays ? null : t('duration');
      }
      case 'pin':
        return !this.pin || isStrongDemoPin(this.pin) ? null : t('pin');
      case 'note':
        return this.note.length > DEMO_LIMITS.note ? t('noteMax') : null;
      default:
        return null;
    }
  }
}

/** One line, at most 200 characters (§8). Shared with the resend modal. */
export function validateInvitationSubject(value: string, t: (key: string) => string): string | null {
  const v = value.trim();
  return v.length > DEMO_LIMITS.invitationSubject || /[\r\n]/.test(v) ? t('invitationSubject') : null;
}
