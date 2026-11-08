import { Component, OnInit, ViewChild, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { LoginService } from '../../../services/login/login.service';
import { DemoAccountsService } from '../../../services/demo-accounts.service';
import {
  DEMO_CHANNELS,
  DEMO_CHANNEL_ICONS,
  DEMO_EMAIL_PATTERN,
  DEMO_LIMITS,
  DEMO_PERMISSIONS,
  DemoChannel,
  SAUDI_MOBILE_PATTERN,
  isStrongDemoPin,
  normalizePhoneInput,
  toLocalPhone
} from '../../../interfaces/demo-account.model';
import { DEMO_FIELD_ALIASES, demoErrorMessage, isNoAnswerError, newIdempotencyKey, readDemoError } from '../demo-accounts.util';
import { DemoAttachmentsComponent } from '../components/demo-attachments/demo-attachments.component';
import { InvitationEditorStore } from '../components/invitation-editor/invitation-editor.store';
import { InvitationEditorComponent } from '../components/invitation-editor/invitation-editor.component';
import { InvitationPreviewComponent } from '../components/invitation-editor/invitation-preview.component';
import { CredentialsDialogComponent, CredentialsDialogData } from '../components/credentials-dialog/credentials-dialog.component';

type CreateField = 'fullName' | 'channel' | 'email' | 'phoneNumber' | 'durationDays' | 'pin' | 'note';

const FIELDS: CreateField[] = ['fullName', 'channel', 'email', 'phoneNumber', 'durationDays', 'pin', 'note'];

// /demo-accounts/new — account details on the start side, the invitation editor under
// them, and the server-rendered preview fixed on the end side.
@Component({
  selector: 'app-demo-account-create',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TablerIconsModule, TranslateModule,
    DemoAttachmentsComponent, InvitationEditorComponent, InvitationPreviewComponent,
  ],
  providers: [InvitationEditorStore],
  templateUrl: './demo-account-create.component.html',
  styleUrl: './demo-account-create.component.scss'
})
export class DemoAccountCreateComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly service = inject(DemoAccountsService);
  private readonly translate = inject(TranslateService);
  private readonly toastr = inject(ToastrService);
  private readonly login = inject(LoginService);
  readonly invitation = inject(InvitationEditorStore);

  @ViewChild(DemoAttachmentsComponent) private attachments?: DemoAttachmentsComponent;

  readonly canManage = computed(() =>
    this.login.permissions().some(p => p.toLowerCase() === DEMO_PERMISSIONS.manage)
  );

  readonly channels = DEMO_CHANNELS;
  readonly channelIcons = DEMO_CHANNEL_ICONS;
  readonly limits = DEMO_LIMITS;
  readonly lang = this.translate.currentLang || 'ar';

  fullName = '';
  channel: DemoChannel = 'Email';
  email = '';
  phoneNumber = '';
  durationDays: number | null = DEMO_LIMITS.defaultDays;
  pin = '';
  note = '';
  showPin = false;

  submitting = false;
  formError: string | null = null;
  /** The feature is off on the backend (DEMO_DISABLED). */
  demoDisabled = false;
  errors: Partial<Record<CreateField, string | null>> = {};
  private readonly touched = new Set<CreateField>();

  // Generated when the page opens; replaced after any answer the admin has to act on.
  private idempotencyKey = newIdempotencyKey();

  ngOnInit(): void {
    if (!this.canManage()) {
      this.toastr.error(this.translate.instant('d3.demoAccounts.errors.forbidden'));
      this.goToList();
      return;
    }
    // No account yet: the preview fills the text with example values.
    // The preview shows what's typed (name, days → expiry) before anything is sent.
    this.invitation.typedValues = () => ({ name: this.fullName, days: Number(this.durationDays) || undefined });
    this.invitation.init({ channel: this.channel });
    this.invitation.attachmentIds = () => this.attachments?.ids ?? [];
  }

  get isEmail(): boolean { return this.channel === 'Email'; }
  get emailRequired(): boolean { return this.isEmail; }
  get phoneRequired(): boolean { return !this.isEmail; }

  /** Off while files upload or the invitation text is invalid / being checked. */
  get canSubmit(): boolean {
    return !this.submitting && !this.demoDisabled && !this.attachments?.uploading && !this.invitation.blocked;
  }

  // ── Accordion ─────────────────────────────────────────────

  /** Both sections start open; each folds on its own. */
  open = { account: true, message: true };

  toggle(section: 'account' | 'message'): void {
    this.open[section] = !this.open[section];
  }

  get accountHasErrors(): boolean {
    return FIELDS.some(f => this.errors[f]);
  }

  /** One line shown on the folded header: name · channel · days. */
  get accountSummary(): string {
    const parts = [
      this.fullName.trim() || this.translate.instant('d3.demoAccounts.create.noName'),
      this.translate.instant(`d3.demoAccounts.channels.${this.channel}`),
      `${Number(this.durationDays) || 0} ${this.translate.instant('d3.demoAccounts.dayUnit')}`,
    ];
    return parts.join(' · ');
  }

  /** The subject (Email) or the first line of the message, else "standard invitation". */
  get messageSummary(): string {
    const inv = this.invitation;
    const text = (this.isEmail && inv.subject.trim()) || inv.message.trim().split('\n')[0];
    return text || this.translate.instant('d3.demoAccounts.standardInvitation');
  }

  // ── Form ──────────────────────────────────────────────────

  setChannel(channel: DemoChannel): void {
    if (this.submitting || channel === this.channel) return;
    this.channel = channel;
    this.invitation.setChannel(channel);
    // The other fields keep their values; only the required star moves.
    this.revalidate(['email', 'phoneNumber']);
  }

  onBlur(field: CreateField): void {
    this.touched.add(field);
    this.errors[field] = this.validate(field);
  }

  onInput(field: CreateField): void {
    if (this.touched.has(field)) this.errors[field] = this.validate(field);
    // These feed the preview — ask for a fresh one (debounced).
    if (field === 'fullName' || field === 'durationDays') this.invitation.refresh();
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
    this.invitation.refresh();
  }

  cancel(): void {
    if (this.submitting) return;
    this.goToList(); // the leave guard asks first when something was typed
  }

  submit(): void {
    if (!this.canSubmit) return;
    FIELDS.forEach(f => this.touched.add(f));
    this.revalidate(FIELDS);
    this.formError = null;
    if (FIELDS.some(f => this.errors[f])) {
      this.scrollToFirstError();
      return;
    }

    const phone = normalizePhoneInput(this.phoneNumber);
    const fullName = this.fullName.trim();
    const { subject, message, language } = this.invitation;
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
      // Empty = the defaults. The message is sent exactly as typed (lines and spaces kept).
      ...(this.isEmail && subject.trim() ? { invitationSubject: subject } : {}),
      ...(message.trim() ? { invitationMessage: message } : {}),
      invitationLanguage: language,
      // Files are for Email only — never sent for WhatsApp/SMS.
      ...(this.isEmail && attachmentIds.length ? { attachmentIds } : {}),
    }, this.idempotencyKey).subscribe({
      next: credentials => {
        this.submitting = false;
        const recipient = this.isEmail ? this.email.trim() : (toLocalPhone(phone) ?? phone);
        // The PIN is shown once, then the account page opens (replacing this form in history).
        this.dialog.open(CredentialsDialogComponent, {
          width: '520px',
          maxWidth: '94vw',
          disableClose: true,
          direction: this.lang === 'en' ? 'ltr' : 'rtl',
          data: { credentials, mode: 'create', recipient } as CredentialsDialogData,
        }).afterClosed().subscribe(() => {
          this.router.navigate(['/', this.lang, 'd3', 'demo-accounts', credentials.account.id], { replaceUrl: true });
        });
      },
      error: err => {
        this.submitting = false;
        const e = readDemoError(err);

        // No answer reached the browser → the same key is safe for the retry; any
        // real answer means the next submit is a new request.
        if (!isNoAnswerError(e)) this.idempotencyKey = newIdempotencyKey();

        if (e.code === 'DEMO_REQUEST_DUPLICATE') {
          // The account exists but the PIN of that response is lost: show it by name.
          this.toastr.warning(demoErrorMessage(e, this.translate));
          const search = fullName.slice(0, DEMO_LIMITS.search);
          this.router.navigate(['/', this.lang, 'd3', 'demo-accounts'], { queryParams: { search: search || null } });
          return;
        }

        if (e.code === 'DEMO_DISABLED') this.demoDisabled = true;

        if (e.code === 'PIN_TOO_WEAK') {
          this.errors.pin = demoErrorMessage(e, this.translate);
          return;
        }

        // DEMO_SUBJECT_INVALID / DEMO_MESSAGE_INVALID → fresh preview marks the text.
        if (this.invitation.handleError(e)) {
          this.open.message = true;
          return;
        }

        // DEMO_ATTACHMENTS_TOO_LARGE / DEMO_ATTACHMENT_INVALID → under the file picker.
        if (e.code?.startsWith('DEMO_ATTACHMENT')) {
          this.attachments?.setError(demoErrorMessage(e, this.translate));
          this.open.message = true;
          return;
        }

        if (e.code === 'VALIDATION_ERROR' && e.fieldErrors.length) {
          const unplaced: string[] = [];
          for (const fe of this.invitation.takeFieldErrors(e.fieldErrors)) {
            const name = fe.field ? (DEMO_FIELD_ALIASES[fe.field] ?? fe.field) : null;
            if (name === 'attachments') { this.attachments?.setError(fe.message); continue; }
            const field = FIELDS.find(f => f.toLowerCase() === name);
            if (field) this.errors[field] = fe.message;
            else unplaced.push(fe.message);
          }
          this.formError = unplaced.length ? unplaced.join(' - ') : null;
          this.scrollToFirstError();
          return;
        }

        // Includes DEMO_SAMPLE_CATALOG_MISSING: nothing was saved, the form stays as it is.
        this.formError = demoErrorMessage(e, this.translate);
        this.scrollToFirstError();
      },
    });
  }

  private goToList(): void {
    this.router.navigate(['/', this.lang, 'd3', 'demo-accounts']);
  }

  /** A long page: open the section that holds an error and bring the first message into view. */
  private scrollToFirstError(): void {
    if (this.accountHasErrors) this.open.account = true;
    if (this.invitation.preview?.isValid === false || this.attachments?.error) this.open.message = true;
    setTimeout(() => document.querySelector('.da-create .da-error, .da-create .da-alert.danger')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
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
