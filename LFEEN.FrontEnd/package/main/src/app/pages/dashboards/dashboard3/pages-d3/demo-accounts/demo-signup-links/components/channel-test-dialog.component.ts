import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DemoSignupLinksService } from '../../../../services/demo-signup-links.service';
import { DEMO_SIGNUP_CHANNELS, DemoSignupChannel, DemoSignupChannels } from '../../../../interfaces/demo-signup-link.model';
import { DEMO_CHANNEL_ICONS, DEMO_EMAIL_PATTERN, SAUDI_MOBILE_PATTERN, normalizePhoneInput } from '../../../../interfaces/demo-account.model';
import { readDemoError } from '../../demo-accounts.util';
import { channelMessage, signupErrorMessage } from '../demo-signup-links.util';

export interface ChannelTestDialogData {
  channels: DemoSignupChannels | null;
}

// "Try sending": a real SMS or email to a number/address the admin types (POST channels/test),
// to check the provider really delivers before handing links out.
@Component({
  selector: 'app-channel-test-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  template: `
    <form class="da-root da-dialog" novalidate autocomplete="off" (ngSubmit)="send()" [dir]="lang === 'en' ? 'ltr' : 'rtl'">
      <div class="da-dialog__head">
        <span class="da-dialog__icon"><i-tabler name="send" class="icon-20"></i-tabler></span>
        <h2>{{ 'd3.demoAccounts.signupLinks.test.title' | translate }}</h2>
      </div>

      <div class="da-dialog__body">
        <p>{{ 'd3.demoAccounts.signupLinks.test.help' | translate }}</p>

        <div class="da-field">
          <span class="da-label" id="ct-channel">{{ 'd3.demoAccounts.signupLinks.test.channel' | translate }}</span>
          <div class="da-segmented" role="radiogroup" aria-labelledby="ct-channel">
            @for (ch of channels; track ch) {
              <!-- A channel that is not ready can't be tested: the server would refuse it anyway. -->
              <button type="button" role="radio" [class.active]="channel === ch" [attr.aria-checked]="channel === ch"
                      [disabled]="sending || !isReady(ch)" [title]="reason(ch) ?? ''" (click)="setChannel(ch)">
                <i-tabler [name]="icons[ch]" class="icon-16"></i-tabler>
                {{ ('d3.demoAccounts.channels.' + ch) | translate }}
                @if (!isReady(ch)) {
                  <small class="ct-off">({{ ('d3.demoAccounts.signupLinks.channels.notReady' + ch) | translate }})</small>
                }
              </button>
            }
          </div>
          @for (ch of channels; track ch) {
            @if (!isReady(ch)) {
              <!-- Not .da-helper: its space-between pushes the icon and the text to opposite edges. -->
              <p class="ct-reason">
                <i-tabler name="alert-triangle" class="icon-14"></i-tabler>
                <span>{{ ('d3.demoAccounts.channels.' + ch) | translate }}: {{ reason(ch) || (('d3.demoAccounts.signupLinks.channels.notReady' + ch) | translate) }}</span>
              </p>
            }
          }
        </div>

        <div class="da-field">
          <label for="ct-recipient">
            {{ (channel === 'Sms' ? 'd3.demoAccounts.create.phone' : 'd3.demoAccounts.create.email') | translate }}<span class="req">*</span>
          </label>
          <input id="ct-recipient" name="ct-recipient" class="da-input" dir="ltr" autocomplete="off" data-lpignore="true" data-1p-ignore
                 [attr.inputmode]="channel === 'Sms' ? 'tel' : 'email'"
                 [placeholder]="channel === 'Sms' ? '05XXXXXXXX' : 'name@example.com'"
                 [class.invalid]="fieldError" [disabled]="sending"
                 [(ngModel)]="recipient" (ngModelChange)="fieldError = null; result = null; error = null" />
          @if (fieldError) { <p class="da-error">{{ fieldError }}</p> }
        </div>

        @if (result) {
          <div class="da-alert success" role="status">
            <i-tabler name="circle-check" class="icon-18"></i-tabler>
            <p>{{ result }}</p>
          </div>
        }
        @if (error) {
          <div class="da-alert danger" role="alert">
            <i-tabler name="alert-circle" class="icon-18"></i-tabler>
            <p>{{ error }}</p>
          </div>
        }
      </div>

      <div class="da-dialog__footer">
        <button type="button" class="da-btn" [disabled]="sending" (click)="close()">{{ 'd3.demoAccounts.actions.close' | translate }}</button>
        <button type="submit" class="da-btn primary" [disabled]="sending">
          @if (sending) { <span class="da-spin"></span> } @else { <i-tabler name="send" class="icon-16"></i-tabler> }
          {{ 'd3.demoAccounts.signupLinks.test.send' | translate }}
        </button>
      </div>
    </form>
  `,
  styles: [`
    @use '../../demo-accounts';
    .da-segmented { grid-template-columns: repeat(2, 1fr); }
    .ct-off { font-size: 11px; font-weight: 600; opacity: 0.8; }
    .ct-reason {
      display: flex; align-items: flex-start; justify-content: flex-start; gap: 6px; margin: 0;
      font-size: 12px; font-weight: 600; line-height: 1.6; color: #b45309;
      i-tabler { flex-shrink: 0; margin-top: 2px; }
    }
  `]
})
export class ChannelTestDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ChannelTestDialogComponent>);
  private readonly service = inject(DemoSignupLinksService);
  private readonly translate = inject(TranslateService);
  /** The last GET channels answer; null = unknown, so both channels stay open. */
  private readonly data = inject<ChannelTestDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  readonly lang = this.translate.currentLang || 'ar';
  readonly channels = DEMO_SIGNUP_CHANNELS;
  readonly icons = DEMO_CHANNEL_ICONS;

  /** Opens on the first ready channel. */
  channel: DemoSignupChannel = DEMO_SIGNUP_CHANNELS.find(ch => this.isReady(ch)) ?? 'Sms';

  isReady(ch: DemoSignupChannel): boolean {
    const c = this.data?.channels;
    if (!c) return true;
    return !!(ch === 'Sms' ? c.sms : c.email)?.ready;
  }

  reason(ch: DemoSignupChannel): string | null {
    const c = this.data?.channels;
    return c ? channelMessage(ch === 'Sms' ? c.sms : c.email, this.lang) : null;
  }
  recipient = '';
  sending = false;
  fieldError: string | null = null;
  result: string | null = null;
  error: string | null = null;

  setChannel(ch: DemoSignupChannel): void {
    if (this.sending || ch === this.channel || !this.isReady(ch)) return;
    this.channel = ch;
    this.recipient = '';
    this.fieldError = this.result = this.error = null;
  }

  close(): void {
    if (!this.sending) this.dialogRef.close();
  }

  send(): void {
    if (this.sending) return;
    const t = (k: string) => this.translate.instant(`d3.demoAccounts.validation.${k}`);
    const isSms = this.channel === 'Sms';
    const value = isSms ? normalizePhoneInput(this.recipient) : this.recipient.trim();
    if (!value) { this.fieldError = t(isSms ? 'phoneRequired' : 'emailRequired'); return; }
    if (isSms ? !SAUDI_MOBILE_PATTERN.test(value) : !DEMO_EMAIL_PATTERN.test(value)) {
      this.fieldError = t(isSms ? 'phoneInvalid' : 'emailInvalid');
      return;
    }

    this.sending = true;
    this.result = this.error = null;
    this.service.testChannel({ channel: this.channel, recipient: value }).subscribe({
      next: res => {
        this.sending = false;
        if (res?.sent === false) {
          this.error = res.error || this.translate.instant('d3.demoAccounts.signupLinks.test.failed');
          return;
        }
        this.result = this.translate.instant('d3.demoAccounts.signupLinks.test.sent');
      },
      error: err => {
        this.sending = false;
        const e = readDemoError(err);
        // The reason (e.g. EMAIL_AUTH_FAILED) is in data.error; message is the sentence to show.
        const reason = err?.error?.data?.error;
        this.error = e.message || reason || signupErrorMessage(e, this.translate);
        if (e.message && reason && !e.message.includes(reason)) this.error = `${e.message} (${reason})`;
      },
    });
  }
}
