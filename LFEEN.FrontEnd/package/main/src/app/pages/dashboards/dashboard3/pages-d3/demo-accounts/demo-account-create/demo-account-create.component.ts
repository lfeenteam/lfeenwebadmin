import { Component, ElementRef, Injector, OnInit, ViewChild, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { AppPluralPipe, translatePlural } from 'src/app/pipes/app-plural.pipe';
import { LoginService } from '../../../services/login/login.service';
import { DemoAccountsService } from '../../../services/demo-accounts.service';
import {
  DEFAULT_DEMO_KIND,
  DEMO_CHANNELS,
  DEMO_CHANNEL_ICONS,
  DEMO_EMAIL_PATTERN,
  DEMO_KINDS,
  DEMO_KIND_ICONS,
  DEMO_LIMITS,
  DEMO_PERMISSIONS,
  DemoAccountKind,
  DemoChannel,
  SAUDI_MOBILE_PATTERN,
  isStrongDemoPin,
  normalizePhoneInput,
  toLocalPhone
} from '../../../interfaces/demo-account.model';
import { DEMO_FIELD_ALIASES, demoErrorMessage, isNoAnswerError, newIdempotencyKey, readDemoError } from '../demo-accounts.util';
import { scrollToFirstError } from '../scroll-to-error';
import { DemoAttachmentsComponent } from '../components/demo-attachments/demo-attachments.component';
import { InvitationEditorStore } from '../components/invitation-editor/invitation-editor.store';
import { InvitationEditorComponent } from '../components/invitation-editor/invitation-editor.component';
import { InvitationPreviewComponent } from '../components/invitation-editor/invitation-preview.component';
import { CredentialsDialogComponent, CredentialsDialogData } from '../components/credentials-dialog/credentials-dialog.component';
import { FieldErrorDirective } from '../../../directives/field-error.directive';

type CreateSection = 'account' | 'trial' | 'message';
type CreateField ='fullName' | 'channel' | 'email' | 'phoneNumber' | 'durationDays' | 'pin' | 'note';

const FIELDS: CreateField[] = ['fullName', 'channel', 'email', 'phoneNumber', 'durationDays', 'pin', 'note'];
/** Which accordion section holds each field (the channel lives in the invitation section). */
const ACCOUNT_FIELDS: CreateField[] = ['fullName', 'email', 'phoneNumber'];
const TRIAL_FIELDS: CreateField[] = ['durationDays', 'pin', 'note'];

// /demo-accounts/new — account details on the start side, the invitation editor under
// them, and the server-rendered preview fixed on the end side.
@Component({
  selector: 'app-demo-account-create',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TablerIconsModule, TranslateModule,
    DemoAttachmentsComponent, InvitationEditorComponent, InvitationPreviewComponent, AppPluralPipe,
    FieldErrorDirective,
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly invitation = inject(InvitationEditorStore);

  @ViewChild(DemoAttachmentsComponent) private attachments?: DemoAttachmentsComponent;

  readonly canManage = computed(() =>
    this.login.permissions().some(p => p.toLowerCase() === DEMO_PERMISSIONS.manage)
  );

  readonly channels = DEMO_CHANNELS;
  readonly channelIcons = DEMO_CHANNEL_ICONS;
  readonly kinds = DEMO_KINDS;
  readonly kindIcons = DEMO_KIND_ICONS;
  readonly limits = DEMO_LIMITS;
  /** Follows the sidebar language switch (the route reuses this component, so it isn't re-created). */
  lang = this.translate.currentLang || 'ar';

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed())
      .subscribe(event => { this.lang = event.lang; });
  }

  get dir(): 'rtl' | 'ltr' {
    return this.lang === 'en' ? 'ltr' : 'rtl';
  }

  /** Which app the account opens: host (default) or guest. */
  kind: DemoAccountKind = DEFAULT_DEMO_KIND;
  fullName = '';
  /**
   * No channel picked (the default) = create by name only: nothing is sent and the admin copies
   * the message from the result dialog. Picking a channel = send the invitation that way.
   */
  channel: DemoChannel | null = null;
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
    // The preview opens on Email until a channel is picked.
    this.invitation.init({ channel: this.channel ?? 'Email', kind: this.kind });
    this.invitation.attachmentIds = () => this.attachments?.ids ?? [];
  }

  /** A channel is picked → the invitation is sent now. */
  get sendInvitation(): boolean { return this.channel !== null; }
  get isEmail(): boolean { return this.channel === 'Email'; }
  /** Email subject and files go only with an email that is actually sent. */
  get sendsEmail(): boolean { return this.isEmail; }
  // Without a channel, both are optional (checked and saved when typed).
  get emailRequired(): boolean { return this.channel === 'Email'; }
  get phoneRequired(): boolean { return this.channel === 'WhatsApp' || this.channel === 'Sms'; }

  /** Off while files upload or the invitation text is invalid / being checked. */
  get canSubmit(): boolean {
    return !this.submitting && !this.demoDisabled && !this.attachments?.uploading && !this.invitation.blocked;
  }

  // ── Accordion ─────────────────────────────────────────────

  /** All sections start open; each folds on its own. */
  open: Record<CreateSection, boolean> = { account: true, trial: true, message: true };

  toggle(section: CreateSection): void {
    this.open[section] = !this.open[section];
  }

  get accountHasErrors(): boolean {
    return ACCOUNT_FIELDS.some(f => this.errors[f]);
  }

  get trialHasErrors(): boolean {
    return TRIAL_FIELDS.some(f => this.errors[f]);
  }

  /** One line shown on the folded header: kind · name · contact. */
  get accountSummary(): string {
    const parts = [
      this.translate.instant(`d3.demoAccounts.kinds.${this.kind}`),
      this.fullName.trim() || this.translate.instant('d3.demoAccounts.create.noName'),
      this.email.trim() || this.phoneNumber.trim(),
    ].filter(Boolean);
    return parts.join(' · ');
  }

  /** Folded trial header: days · PIN auto/custom. */
  get trialSummary(): string {
    const days = translatePlural(this.translate, 'd3.demoAccounts.days', Number(this.durationDays) || 0);
    const pin = this.translate.instant(this.pin ? 'd3.demoAccounts.create.pinCustom' : 'd3.demoAccounts.create.pinAuto');
    return `${days} · ${pin}`;
  }

  /** Channel · the subject (Email) or the first line of the message, else "standard invitation". */
  get messageSummary(): string {
    const inv = this.invitation;
    const channel = this.channel
      ? this.translate.instant(`d3.demoAccounts.channels.${this.channel}`)
      : this.translate.instant('d3.demoAccounts.create.noChannel');
    const text = (this.sendsEmail && inv.subject.trim()) || inv.message.trim().split('\n')[0];
    return `${channel} · ${text || this.translate.instant('d3.demoAccounts.standardInvitation')}`;
  }

  // ── Trial length ──────────────────────────────────────────

  /** Quick picks shown next to the stepper. */
  readonly dayPresets = [7, 14, 30, 60].filter(d => d >= DEMO_LIMITS.minDays && d <= DEMO_LIMITS.maxDays);

  /** The trial's last day if it were created now (the server sets the real one). */
  get endDate(): Date | null {
    const days = Number(this.durationDays);
    if (!Number.isInteger(days) || days < DEMO_LIMITS.minDays || days > DEMO_LIMITS.maxDays) return null;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

  setDays(days: number): void {
    if (this.submitting) return;
    this.durationDays = days;
    this.onBlur('durationDays');
    this.invitation.refresh();
  }

  /** A random 6-digit PIN that passes the strength rule (no repeats or runs). */
  generatePin(): void {
    if (this.submitting) return;
    const buf = new Uint32Array(1);
    let pin = '';
    do {
      crypto.getRandomValues(buf);
      pin = String(buf[0] % 1_000_000).padStart(6, '0');
    } while (!isStrongDemoPin(pin));
    this.pin = pin;
    this.showPin = true;
    this.touched.add('pin');
    this.errors.pin = null;
  }

  // ── Form ──────────────────────────────────────────────────

  /** The editor reloads this kind's variables and presets and previews again. */
  setKind(kind: DemoAccountKind): void {
    if (this.submitting || kind === this.kind) return;
    this.kind = kind;
    this.formError = null;
    this.invitation.setKind(kind);
  }

  /** Picks a channel; null = "don't send" (create by name only). */
  setChannel(channel: DemoChannel | null): void {
    if (this.submitting || channel === this.channel) return;
    this.channel = channel;
    if (this.channel) this.invitation.setChannel(this.channel);
    this.formError = null;
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
    const send = this.sendInvitation;
    const channel = this.channel;
    this.submitting = true;
    this.attachments?.setError(null);

    this.service.create({
      kind: this.kind,
      fullName,
      email: this.email.trim() || null,
      phoneNumber: phone || null,
      // Create only: no channel (the account gets "None"); never send "None" ourselves.
      ...(channel ? { channel } : {}),
      sendInvitation: send,
      durationDays: Number(this.durationDays),
      pin: this.pin || null,
      note: this.note.trim() || null,
      // Empty = the defaults. The message is sent exactly as typed (lines and spaces kept).
      // It also builds the message to copy when nothing is sent.
      ...(this.sendsEmail && subject.trim() ? { invitationSubject: subject } : {}),
      ...(message.trim() ? { invitationMessage: message } : {}),
      invitationLanguage: language,
      // Files are for a sent Email only — never for WhatsApp/SMS or create only.
      ...(this.sendsEmail && attachmentIds.length ? { attachmentIds } : {}),
    }, this.idempotencyKey).subscribe({
      next: credentials => {
        this.submitting = false;
        const recipient = !channel ? null : channel === 'Email' ? this.email.trim() : (toLocalPhone(phone) ?? phone);
        // The PIN is shown once, then the account page opens (replacing this form in history).
        this.dialog.open(CredentialsDialogComponent, {
          width: '560px',
          maxWidth: '94vw',
          disableClose: true,
          direction: this.dir,
          data: { credentials, mode: 'create', recipient, invitationRequested: send } as CredentialsDialogData,
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
    if (this.trialHasErrors) this.open.trial = true;
    if (this.errors.channel || this.invitation.preview?.isValid === false || this.attachments?.error) this.open.message = true;
    scrollToFirstError(this.host.nativeElement, this.injector);
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
