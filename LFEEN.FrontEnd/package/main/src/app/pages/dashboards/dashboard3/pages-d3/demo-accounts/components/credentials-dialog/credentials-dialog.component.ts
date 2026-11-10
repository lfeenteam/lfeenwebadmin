import { Component, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Clipboard } from '@angular/cdk/clipboard';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { DemoAccount, DemoAccountCredentials, toLocalPhone } from '../../../../interfaces/demo-account.model';
import { formatRiyadhDate } from '../../demo-accounts.util';

export interface CredentialsDialogData {
  credentials: DemoAccountCredentials;
  mode: 'create' | 'resetPin';
  /** The email/phone the admin typed (create) or the account's contact for its channel (new PIN). */
  recipient: string | null;
}

// No "resend" way out: a resend would replace the PIN shown in this dialog.
export type CredentialsDialogResult = 'closed';

type CopyKey = 'sid' | 'phone' | 'pin' | 'all';

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
  readonly recipient = this.data.recipient;

  pin = this.data.credentials.pin;
  showPin = true;
  copied: CopyKey | null = null;
  private copiedTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    // Drop the caller's reference so the PIN only exists here.
    this.data.credentials.pin = '';
  }

  get titleKey(): string {
    if (this.mode === 'resetPin') return 'd3.demoAccounts.credentials.titleNewPin';
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
      : key === 'pin' ? this.pin
      : this.copyAllText();

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

  // No verification code (not available) and no login URL (it is in the invitation).
  private copyAllText(): string {
    const t = (key: string) => this.translate.instant(`d3.demoAccounts.credentials.copyAll.${key}`);
    return [
      t('heading'),
      `${t('sid')}: ${this.account.loginSid}`,
      `${t('phone')}: ${this.loginPhone}`,
      `${t('pin')}: ${this.pin}`,
      `${t('expires')}: ${formatRiyadhDate(this.account.expiresAt, this.lang) ?? ''}`,
    ].join('\n');
  }

  private wipe(): void {
    this.pin = '';
  }
}
