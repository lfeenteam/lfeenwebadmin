import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import { DemoAccountsService } from '../../../../services/demo-accounts.service';
import {
  DEMO_CHANNELS,
  DEMO_CHANNEL_ICONS,
  DEMO_LIMITS,
  DemoAccount,
  DemoAccountCredentials,
  DemoChannel,
  ResendDemoRequest,
  isStrongDemoPin
} from '../../../../interfaces/demo-account.model';
import { DEMO_FIELD_ALIASES, DemoApiError, demoErrorMessage, formatRiyadhDate, readDemoError } from '../../demo-accounts.util';
import { DemoAttachmentsComponent } from '../demo-attachments/demo-attachments.component';
import { validateInvitationSubject } from '../create-demo-dialog/create-demo-dialog.component';

export type DemoAction = 'resend' | 'resetPin' | 'extend' | 'unlock' | 'disable';

export interface DemoActionDialogData {
  action: DemoAction;
  account: DemoAccount;
}

export type DemoActionDialogResult =
  | { type: 'account'; account: DemoAccount }
  | { type: 'credentials'; credentials: DemoAccountCredentials }
  /** Codes the page must react to (not found → back to list, disabled → reload). */
  | { type: 'error'; error: DemoApiError };

const DAY_MS = 24 * 60 * 60 * 1000;
// Errors the page handles itself instead of showing them inside the dialog.
const PAGE_LEVEL_CODES = new Set(['DEMO_ACCOUNT_NOT_FOUND', 'DEMO_ACCOUNT_DISABLED']);

// One confirmation/modal per action (§5.4). The dialog owns the call: it disables its
// buttons, shows a spinner, keeps errors inline and never retries on its own.
@Component({
  selector: 'app-demo-action-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatTooltipModule, TablerIconsModule, TranslateModule, DemoAttachmentsComponent],
  templateUrl: './demo-action-dialog.component.html',
  styleUrl: './demo-action-dialog.component.scss'
})
export class DemoActionDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<DemoActionDialogComponent, DemoActionDialogResult>);
  private readonly data = inject<DemoActionDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(DemoAccountsService);
  private readonly translate = inject(TranslateService);

  @ViewChild(DemoAttachmentsComponent) private attachments?: DemoAttachmentsComponent;

  readonly action = this.data.action;
  /** Replaced by the full account on open for resend (list items carry no subject/files). */
  account = this.data.account;
  readonly channels = DEMO_CHANNELS;
  readonly channelIcons = DEMO_CHANNEL_ICONS;
  readonly limits = DEMO_LIMITS;
  readonly lang = this.translate.currentLang || 'ar';

  submitting = false;
  error: string | null = null;
  fieldError: string | null = null;

  // resend
  channel: DemoChannel = this.account.channel;
  /** Pre-filled with the saved subject (empty when null). */
  subject = '';
  subjectError: string | null = null;
  /** The saved subject/files are loaded before the form shows. */
  detailsReady = this.action !== 'resend';
  detailsError: string | null = null;
  // reset PIN
  pin = '';
  showPin = false;
  sendInvitation = true;
  // extend
  days: number | null = DEMO_LIMITS.defaultDays;
  // disable
  understood = false;

  get titleKey(): string {
    return `d3.demoAccounts.dialogs.${this.action}.title`;
  }

  get confirmKey(): string {
    return `d3.demoAccounts.dialogs.${this.action}.confirm`;
  }

  get isDanger(): boolean {
    return this.action === 'disable';
  }

  get icon(): string {
    switch (this.action) {
      case 'resend': return 'send';
      case 'resetPin': return 'key';
      case 'extend': return 'calendar-plus';
      case 'unlock': return 'lock-open';
      default: return 'ban';
    }
  }

  get canSubmit(): boolean {
    if (this.submitting) return false;
    if (this.action === 'disable') return this.understood;
    if (this.action === 'resend') {
      return this.detailsReady && !this.attachments?.uploading && this.hasContact(this.channel);
    }
    return true;
  }

  ngOnInit(): void {
    if (this.action === 'resend') this.loadDetails();
  }

  // ── resend ─────────────────────────────────────────────────

  get isEmail(): boolean {
    return this.channel === 'Email';
  }

  /** Fetches the saved subject and files so they can be pre-filled (§6). */
  loadDetails(): void {
    this.detailsError = null;
    this.service.get(this.account.id).subscribe({
      next: account => {
        this.account = { ...account, attachments: account.attachments ?? [] };
        this.subject = account.invitationSubject ?? '';
        this.detailsReady = true;
      },
      error: err => {
        const e = readDemoError(err);
        if (e.code && PAGE_LEVEL_CODES.has(e.code)) {
          this.dialogRef.close({ type: 'error', error: e });
          return;
        }
        this.detailsError = demoErrorMessage(e, this.translate);
      },
    });
  }

  onSubjectInput(): void {
    if (this.subjectError) this.subjectError = this.validateSubject();
  }

  validateSubject(): string | null {
    return validateInvitationSubject(this.subject, k => this.translate.instant(`d3.demoAccounts.validation.${k}`));
  }

  /** Only what changed is sent (§6). Subject and files only for Email. */
  private resendBody(): ResendDemoRequest {
    const body: ResendDemoRequest = {};
    if (this.channel !== this.account.channel) body.channel = this.channel;
    if (this.isEmail) {
      const subject = this.subject.trim();
      if (subject !== (this.account.invitationSubject ?? '').trim()) body.invitationSubject = subject; // "" = default
      if (this.attachments?.touched) body.attachmentIds = this.attachments.ids; // full list; [] removes all
    }
    return body;
  }

  hasContact(channel: DemoChannel): boolean {
    return channel === 'Email' ? !!this.account.email : !!this.account.contactPhone;
  }

  noContactTip(channel: DemoChannel): string {
    if (this.hasContact(channel)) return '';
    return this.translate.instant(channel === 'Email'
      ? 'd3.demoAccounts.dialogs.resend.noEmail'
      : 'd3.demoAccounts.dialogs.resend.noPhone');
  }

  setChannel(channel: DemoChannel): void {
    if (this.submitting || !this.hasContact(channel)) return;
    this.channel = channel;
    this.error = null;
  }

  // ── reset PIN ──────────────────────────────────────────────

  onPinInput(value: string, input: HTMLInputElement): void {
    this.pin = (value ?? '').replace(/\D/g, '').slice(0, 6);
    if (input.value !== this.pin) input.value = this.pin;
    if (this.fieldError) this.fieldError = this.validatePin();
  }

  validatePin(): string | null {
    return !this.pin || isStrongDemoPin(this.pin) ? null : this.translate.instant('d3.demoAccounts.validation.pin');
  }

  // ── extend ─────────────────────────────────────────────────

  get daysValid(): boolean {
    const d = Number(this.days);
    return Number.isInteger(d) && d >= DEMO_LIMITS.minDays && d <= DEMO_LIMITS.maxDays;
  }

  /** max(today, expiresAt) + days, capped at today + 60 days — the server may still return an earlier date. */
  get extendPreview(): string | null {
    if (!this.daysValid) return null;
    const now = Date.now();
    const expires = parseApiUtc(this.account.expiresAt)?.getTime() ?? now;
    const base = Math.max(now, expires);
    const target = Math.min(base + Number(this.days) * DAY_MS, now + DEMO_LIMITS.maxDays * DAY_MS);
    return formatRiyadhDate(new Date(target), this.lang);
  }

  stepDays(delta: number): void {
    const current = Number(this.days) || DEMO_LIMITS.defaultDays;
    this.days = Math.min(DEMO_LIMITS.maxDays, Math.max(DEMO_LIMITS.minDays, current + delta));
    this.fieldError = null;
  }

  // ── submit ─────────────────────────────────────────────────

  cancel(): void {
    if (!this.submitting) this.dialogRef.close();
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.error = null;

    if (this.action === 'resetPin') {
      this.fieldError = this.validatePin();
      if (this.fieldError) return;
    }
    if (this.action === 'resend' && this.isEmail) {
      this.subjectError = this.validateSubject();
      if (this.subjectError) return;
    }
    if (this.action === 'extend' && !this.daysValid) {
      this.fieldError = this.translate.instant('d3.demoAccounts.validation.duration');
      return;
    }

    const id = this.account.id;
    let request: Observable<DemoAccount | DemoAccountCredentials>;
    switch (this.action) {
      case 'resend':
        request = this.service.resend(id, this.resendBody());
        break;
      case 'resetPin':
        request = this.service.resetPin(id, { pin: this.pin || null, sendInvitation: this.sendInvitation });
        break;
      case 'extend':
        request = this.service.extend(id, Number(this.days));
        break;
      case 'unlock':
        request = this.service.unlock(id);
        break;
      default:
        request = this.service.disable(id);
    }

    this.submitting = true;
    request.subscribe({
      next: res => {
        this.submitting = false;
        this.pin = '';
        this.dialogRef.close(this.action === 'resetPin'
          ? { type: 'credentials', credentials: res as DemoAccountCredentials }
          : { type: 'account', account: res as DemoAccount });
      },
      error: err => {
        this.submitting = false;
        const e = readDemoError(err);
        if (e.code && PAGE_LEVEL_CODES.has(e.code)) {
          this.dialogRef.close({ type: 'error', error: e });
          return;
        }
        if (e.code === 'PIN_TOO_WEAK') {
          this.fieldError = demoErrorMessage(e, this.translate);
          return;
        }
        if (this.action === 'resend') {
          // Attachment errors go under the picker, subject errors under the subject.
          if (e.code?.startsWith('DEMO_ATTACHMENT')) {
            this.attachments?.setError(demoErrorMessage(e, this.translate));
            return;
          }
          if (e.code === 'VALIDATION_ERROR' && e.fieldErrors.length) {
            const unplaced: string[] = [];
            for (const fe of e.fieldErrors) {
              const name = fe.field ? (DEMO_FIELD_ALIASES[fe.field] ?? fe.field) : null;
              if (name === 'subject') this.subjectError = fe.message;
              else if (name === 'attachments') this.attachments?.setError(fe.message);
              else unplaced.push(fe.message);
            }
            this.error = unplaced.length ? unplaced.join(' - ') : null;
            return;
          }
        }
        // Validation errors of these forms have a single field (Pin / Days / Channel).
        if (e.code === 'VALIDATION_ERROR' && e.fieldErrors.length === 1 && e.fieldErrors[0].field !== 'channel') {
          this.fieldError = e.fieldErrors[0].message;
          return;
        }
        this.error = demoErrorMessage(e, this.translate);
      },
    });
  }
}
