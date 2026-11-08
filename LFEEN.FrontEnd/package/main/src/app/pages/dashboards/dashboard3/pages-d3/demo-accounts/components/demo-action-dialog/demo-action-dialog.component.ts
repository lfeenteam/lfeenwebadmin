import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import { DemoAccountsService } from '../../../../services/demo-accounts.service';
import {
  DEMO_LIMITS,
  DemoAccount,
  DemoAccountCredentials,
  isStrongDemoPin
} from '../../../../interfaces/demo-account.model';
import { DemoApiError, demoErrorMessage, formatRiyadhDate, readDemoError } from '../../demo-accounts.util';

/** Every account action. Resend has its own page (it holds the invitation editor). */
export type DemoAction = 'resend' | 'resetPin' | 'extend' | 'unlock' | 'disable';
export type DemoDialogAction = Exclude<DemoAction, 'resend'>;

export interface DemoActionDialogData {
  action: DemoDialogAction;
  account: DemoAccount;
}

export type DemoActionDialogResult =
  | { type: 'account'; account: DemoAccount }
  | { type: 'credentials'; credentials: DemoAccountCredentials }
  /** Codes the page must react to (not found → back to list, disabled → reload). */
  | { type: 'error'; error: DemoApiError };

const DAY_MS = 24 * 60 * 60 * 1000;
// Errors the page handles itself instead of showing them inside the dialog.
export const DEMO_PAGE_LEVEL_CODES = new Set(['DEMO_ACCOUNT_NOT_FOUND', 'DEMO_ACCOUNT_DISABLED']);

// One confirmation modal per small action (new PIN, extend, unlock, disable). The dialog
// owns the call: it disables its buttons, shows a spinner, keeps errors inline and never
// retries on its own.
@Component({
  selector: 'app-demo-action-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './demo-action-dialog.component.html',
  styleUrl: './demo-action-dialog.component.scss'
})
export class DemoActionDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DemoActionDialogComponent, DemoActionDialogResult>);
  private readonly data = inject<DemoActionDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(DemoAccountsService);
  private readonly translate = inject(TranslateService);

  readonly action = this.data.action;
  readonly account = this.data.account;
  readonly limits = DEMO_LIMITS;
  readonly lang = this.translate.currentLang || 'ar';

  submitting = false;
  error: string | null = null;
  fieldError: string | null = null;

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
      case 'resetPin': return 'key';
      case 'extend': return 'calendar-plus';
      case 'unlock': return 'lock-open';
      default: return 'ban';
    }
  }

  get canSubmit(): boolean {
    if (this.submitting) return false;
    if (this.action === 'disable') return this.understood;
    return true;
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
    if (this.action === 'extend' && !this.daysValid) {
      this.fieldError = this.translate.instant('d3.demoAccounts.validation.duration');
      return;
    }

    const id = this.account.id;
    let request: Observable<DemoAccount | DemoAccountCredentials>;
    switch (this.action) {
      case 'resetPin':
        // The invitation (if sent) uses the saved subject, message and files.
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
        if (e.code && DEMO_PAGE_LEVEL_CODES.has(e.code)) {
          this.dialogRef.close({ type: 'error', error: e });
          return;
        }
        if (e.code === 'PIN_TOO_WEAK') {
          this.fieldError = demoErrorMessage(e, this.translate);
          return;
        }
        // Validation errors of these forms have a single field (Pin / Days).
        if (e.code === 'VALIDATION_ERROR' && e.fieldErrors.length === 1) {
          this.fieldError = e.fieldErrors[0].message;
          return;
        }
        this.error = demoErrorMessage(e, this.translate);
      },
    });
  }
}
