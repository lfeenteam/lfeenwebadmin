import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import {
  DEMO_KIND_ICONS,
  DemoAccount,
  DemoAccountCredentials,
  DemoAccountKind,
  demoKindOf,
  demoVerificationCode,
  toLocalPhone
} from '../../../../interfaces/demo-account.model';
import { formatRiyadhDate } from '../../demo-accounts.util';

export interface CredentialsDialogData {
  credentials: DemoAccountCredentials;
  mode: 'create' | 'resetPin' | 'resend';
  /** The email/phone the invitation went to (create / resend) or the account's contact for its channel (new PIN). */
  recipient: string | null;
  /** false = the admin chose not to send anything (create by name only / new PIN without sending). */
  invitationRequested?: boolean;
}

// No "resend" way out: a resend would replace the PIN shown in this dialog.
export type CredentialsDialogResult = 'closed';

type CopyKey = 'sid' | 'phone' | 'birth' | 'pin' | 'otp' | 'all';

// The only place the PIN is ever shown (§4.3 / §6.1). It lives in this component's
// state only: it is taken out of the dialog data on open and wiped on close/destroy,
// and is never logged, stored or put in a URL.
@Component({
  selector: 'app-credentials-dialog',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './credentials-dialog.component.html',
  styleUrl: './credentials-dialog.component.scss'
})
export class CredentialsDialogComponent implements OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<CredentialsDialogComponent, CredentialsDialogResult>);
  private readonly data = inject<CredentialsDialogData>(MAT_DIALOG_DATA);
  private readonly clipboard = inject(Clipboard);
  private readonly translate = inject(TranslateService);
  private readonly toastr = inject(ToastrService);

  readonly lang = this.translate.currentLang || 'ar';
  readonly mode = this.data.mode;
  readonly account: DemoAccount = this.data.credentials.account;
  readonly invitationSent = this.data.credentials.invitationSent;
  readonly reopened = this.data.credentials.reopened;
  /** Where it went; falls back to the account's saved contact (e.g. a reopened account kept its own channel). */
  readonly recipient = this.data.recipient
    || (this.account.channel === 'Email' ? this.account.email
      : this.account.channel === 'None' ? null
      : toLocalPhone(this.account.contactPhone));
  readonly invitationRequested = this.data.invitationRequested !== false;
  readonly kind: DemoAccountKind = demoKindOf(this.account);
  readonly kindIcon = DEMO_KIND_ICONS[this.kind];
  /** Guest accounts only — the guest app asks for it next to the ID number. Shown as sent (dd-MM-yyyy). */
  readonly birthDate: string | null = this.kind === 'Client' ? (this.account.birthDate || null) : null;

  pin = this.data.credentials.pin;
  /** Sign-in code (OTP); null when the server has none ("-") or is older. */
  verificationCode: string | null = demoVerificationCode(this.data.credentials.verificationCode);
  /** The invitation exactly as the person gets it (holds the PIN) — shown, and copied as is. */
  renderedMessage: string | null = this.data.credentials.renderedMessage?.trim() ? this.data.credentials.renderedMessage : null;
  showPin = true;
  copied: CopyKey | null = null;
  private copiedTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Drop the caller's references so the PIN (also inside the message) only exists here.
    this.data.credentials.pin = '';
    this.data.credentials.verificationCode = null;
    this.data.credentials.renderedMessage = null;
  }

  get titleKey(): string {
    if (this.mode === 'resetPin') return 'd3.demoAccounts.credentials.titleNewPin';
    if (this.mode === 'resend') return 'd3.demoAccounts.credentials.titleResent';
    return this.reopened ? 'd3.demoAccounts.credentials.titleReopened' : 'd3.demoAccounts.credentials.titleCreated';
  }

  get channelLabel(): string {
    return this.translate.instant(`d3.demoAccounts.channels.${this.account.channel}`);
  }

  get loginPhone(): string {
    return toLocalPhone(this.account.loginPhone) ?? '';
  }

  get expiresAt(): string {
    return formatRiyadhDate(this.account.expiresAt, this.lang, true) ?? '—';
  }

  copy(key: CopyKey): void {
    const value = key === 'sid' ? this.account.loginSid
      : key === 'phone' ? this.loginPhone
      : key === 'birth' ? this.birthDate
      : key === 'pin' ? this.pin
      : key === 'otp' ? this.verificationCode
      : this.renderedMessage ?? this.copyAllText();

    if (!value || !this.clipboard.copy(value)) {
      this.toastr.error(this.translate.instant('d3.demoAccounts.copyFailed'));
      return;
    }
    this.copied = key;
    clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => (this.copied = null), 1800);
    this.toastr.success(this.translate.instant('d3.demoAccounts.copied'));
  }

  close(result: CredentialsDialogResult = 'closed'): void {
    this.wipe();
    this.dialogRef.close(result);
  }

  ngOnDestroy(): void {
    clearTimeout(this.copiedTimer);
    this.wipe();
  }

  // Only when the server sent no renderedMessage (older server): a friendly message
  // with the sign-in details we have here (no login URL — the server knows it).
  private copyAllText(): string {
    const t = (key: string, params?: Record<string, unknown>) =>
      this.translate.instant(`d3.demoAccounts.credentials.copyAll.${key}`, params);
    const name = this.account.fullName?.trim();
    return [
      name ? t('greeting', { name }) : t('greetingNoName'),
      '',
      t(this.kind === 'Client' ? 'introClient' : 'intro'),
      '',
      `🪪 ${t('sid')}: ${this.account.loginSid}`,
      ...(this.birthDate ? [`🎂 ${t('birthDate')}: ${this.birthDate}`] : []),
      `📱 ${t('phone')}: ${this.loginPhone}`,
      ...(this.verificationCode ? [`🔢 ${t('verificationCode')}: ${this.verificationCode}`] : []),
      `🔐 ${t('pin')}: ${this.pin}`,
      '',
      `${t('expires')} ${formatRiyadhDate(this.account.expiresAt, this.lang) ?? ''}`,
      '',
      t('signOff'),
    ].join('\n');
  }

  private wipe(): void {
    this.pin = '';
    this.verificationCode = null;
    this.renderedMessage = null;
  }
}
