import { Component, ElementRef, Injector, OnDestroy, OnInit, ViewChild, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { LoginService } from '../../../services/login/login.service';
import { DemoAccountsService } from '../../../services/demo-accounts.service';
import { PageTitleOverrideService } from '../../../services/page-title-override.service';
import {
  DEMO_CHANNELS,
  DEMO_CHANNEL_ICONS,
  DEMO_EMAIL_PATTERN,
  DEMO_LIMITS,
  DEMO_PERMISSIONS,
  DemoAccount,
  DemoChannel,
  DemoResendResult,
  ResendDemoRequest,
  SAUDI_MOBILE_PATTERN,
  demoKindOf,
  normalizePhoneInput,
  toLocalPhone
} from '../../../interfaces/demo-account.model';
import { DEMO_FIELD_ALIASES, DemoApiError, demoActionToast, demoErrorMessage, readDemoError } from '../demo-accounts.util';
import { scrollToFirstError } from '../scroll-to-error';
import { DEMO_PAGE_LEVEL_CODES } from '../components/demo-action-dialog/demo-action-dialog.component';
import { DemoAttachmentsComponent } from '../components/demo-attachments/demo-attachments.component';
import { InvitationEditorStore } from '../components/invitation-editor/invitation-editor.store';
import { InvitationEditorComponent } from '../components/invitation-editor/invitation-editor.component';
import { InvitationPreviewComponent } from '../components/invitation-editor/invitation-preview.component';
import { CredentialsDialogComponent, CredentialsDialogData } from '../components/credentials-dialog/credentials-dialog.component';

// /demo-accounts/:id/resend — pick the channel, edit the saved invitation and send it
// again. Every resend issues a new PIN, shown once in the credentials dialog afterwards.
// An account made by name only (channel "None") gets its email/phone typed here.
@Component({
  selector: 'app-demo-account-resend',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TablerIconsModule, TranslateModule,
    DemoAttachmentsComponent, InvitationEditorComponent, InvitationPreviewComponent,
  ],
  providers: [InvitationEditorStore],
  templateUrl: './demo-account-resend.component.html',
  styleUrl: './demo-account-resend.component.scss'
})
export class DemoAccountResendComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly service = inject(DemoAccountsService);
  private readonly translate = inject(TranslateService);
  private readonly toastr = inject(ToastrService);
  private readonly login = inject(LoginService);
  private readonly pageTitle = inject(PageTitleOverrideService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly invitation = inject(InvitationEditorStore);

  @ViewChild(DemoAttachmentsComponent) private attachments?: DemoAttachmentsComponent;

  readonly canManage = computed(() =>
    this.login.permissions().some(p => p.toLowerCase() === DEMO_PERMISSIONS.manage)
  );

  readonly channels = DEMO_CHANNELS;
  readonly channelIcons = DEMO_CHANNEL_ICONS;
  /** Follows the sidebar language switch (the route reuses this component, so it isn't re-created). */
  lang = this.translate.currentLang || 'ar';
  readonly limits = DEMO_LIMITS;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed())
      .subscribe(event => { this.lang = event.lang; });
  }

  get dir(): 'rtl' | 'ltr' {
    return this.lang === 'en' ? 'ltr' : 'rtl';
  }

  id = '';
  account: DemoAccount | null = null;
  channel: DemoChannel = 'Email';
  loading = true;
  loadError: string | null = null;

  /** Typed only when the account has no email / phone for the chosen channel. */
  email = '';
  phoneNumber = '';
  contactTouched = false;
  /** Server error about the recipient (DEMO_RECIPIENT_REQUIRED / EMAIL / PHONE). */
  contactServerError: string | null = null;

  submitting = false;
  error: string | null = null;

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.canManage()) {
      this.toastr.error(this.translate.instant('d3.demoAccounts.errors.forbidden'));
      this.goToDetails();
      return;
    }
    this.load();
  }

  ngOnDestroy(): void {
    this.pageTitle.clear();
  }

  get isEmail(): boolean { return this.channel === 'Email'; }

  get canSubmit(): boolean {
    return !!this.account && !this.submitting && !this.attachments?.uploading
      && !this.invitation.blocked && (this.hasContact(this.channel) || !this.contactError(true));
  }

  /** The account has no saved contact for the chosen channel → the page asks for it. */
  get needsContact(): boolean {
    return !!this.account && !this.hasContact(this.channel);
  }

  /** Message under the typed email/phone; `force` checks even before the field was left. */
  contactError(force = false): string | null {
    if (!this.needsContact) return null;
    if (this.contactServerError) return this.contactServerError;
    if (!force && !this.contactTouched) return null;
    const t = (key: string) => this.translate.instant(`d3.demoAccounts.validation.${key}`);
    if (this.isEmail) {
      const v = this.email.trim();
      if (!v) return t('emailRequired');
      return v.length > DEMO_LIMITS.email || !DEMO_EMAIL_PATTERN.test(v) ? t('emailInvalid') : null;
    }
    const v = normalizePhoneInput(this.phoneNumber);
    if (!v) return t('phoneRequired');
    return SAUDI_MOBILE_PATTERN.test(v) ? null : t('phoneInvalid');
  }

  onContactInput(): void {
    this.contactServerError = null;
  }

  /** Fetches the account with its saved texts and files, so the form is pre-filled with them. */
  load(): void {
    this.loading = true;
    this.loadError = null;
    this.service.get(this.id).subscribe({
      next: account => {
        this.loading = false;
        if (account.status === 'Disabled') {
          this.toastr.error(this.translate.instant('d3.demoAccounts.errors.DEMO_ACCOUNT_DISABLED'));
          this.goToDetails();
          return;
        }
        this.account = { ...account, attachments: account.attachments ?? [], deliveries: account.deliveries ?? [] };
        // "None" (made by name only): start on a channel it has a contact for, else Email.
        this.channel = account.channel !== 'None' ? account.channel
          : account.email ? 'Email'
          : account.contactPhone ? 'WhatsApp'
          : 'Email';
        this.pageTitle.set(account.fullName);
        // The preview uses this account's real values.
        // Variables and presets follow the account's own kind ({{9}} / guest-* for guest accounts).
        this.invitation.init({
          channel: this.channel,
          kind: demoKindOf(account),
          demoAccountId: account.id,
          subject: account.invitationSubject,
          message: account.invitationMessage,
          language: account.invitationLanguage,
        });
        this.invitation.attachmentIds = () => this.attachments?.ids ?? [];
      },
      error: err => {
        this.loading = false;
        const e = readDemoError(err);
        if (this.handlePageError(e)) return;
        this.loadError = demoErrorMessage(e, this.translate);
      },
    });
  }

  // ── Channel ───────────────────────────────────────────────

  hasContact(channel: DemoChannel): boolean {
    if (!this.account) return false;
    return channel === 'Email' ? !!this.account.email : !!this.account.contactPhone;
  }

  /** Every channel can be picked: without a saved contact the page asks for it. */
  setChannel(channel: DemoChannel): void {
    if (this.submitting || channel === this.channel) return;
    this.channel = channel;
    this.invitation.setChannel(channel);
    this.error = null;
    this.contactServerError = null;
    this.contactTouched = false;
  }

  // ── Send ──────────────────────────────────────────────────

  cancel(): void {
    if (this.submitting) return;
    this.goToDetails(); // the leave guard asks first when something changed
  }

  submit(): void {
    this.contactTouched = true;
    if (!this.canSubmit || !this.account) {
      if (this.contactError(true)) this.scrollToFirstError();
      return;
    }
    this.error = null;
    this.attachments?.setError(null);
    this.submitting = true;

    this.service.resend(this.account.id, this.resendBody()).subscribe({
      next: result => {
        this.submitting = false;
        // The new PIN came back: show it once with the message as sent, then the account page.
        if (result.pin) {
          this.showCredentials(result);
          return;
        }
        // Older server (no PIN in the answer): 200 even when delivery failed — the toast reads deliveries[0].succeeded.
        const toast = demoActionToast('resend', result, this.translate, this.lang);
        if (toast) toast.ok ? this.toastr.success(toast.message) : this.toastr.error(toast.message);
        this.goToDetails(true);
      },
      error: err => {
        this.submitting = false;
        const e = readDemoError(err);
        if (this.handlePageError(e)) return;
        // Wherever the message lands below, bring it into view (runs after it renders).
        this.scrollToFirstError();
        // No email/phone for this channel → under the contact field (the old PIN still works).
        if (e.code === 'DEMO_RECIPIENT_REQUIRED' || e.code === 'DEMO_EMAIL_REQUIRED' || e.code === 'DEMO_PHONE_REQUIRED') {
          if (this.needsContact) {
            this.contactServerError = demoErrorMessage(e, this.translate);
            return;
          }
        }
        // DEMO_SUBJECT_INVALID / DEMO_MESSAGE_INVALID → fresh preview marks the text.
        if (this.invitation.handleError(e)) return;
        // DEMO_ATTACHMENTS_EMAIL_ONLY / TOO_LARGE / INVALID → under the file picker.
        if (e.code?.startsWith('DEMO_ATTACHMENT')) {
          this.attachments?.setError(demoErrorMessage(e, this.translate));
          return;
        }
        if (e.code === 'VALIDATION_ERROR' && e.fieldErrors.length) {
          const unplaced: string[] = [];
          for (const fe of this.invitation.takeFieldErrors(e.fieldErrors)) {
            const name = fe.field ? (DEMO_FIELD_ALIASES[fe.field] ?? fe.field) : null;
            if (name === 'attachments') this.attachments?.setError(fe.message);
            else unplaced.push(fe.message);
          }
          this.error = unplaced.length ? unplaced.join(' - ') : null;
          return;
        }
        this.error = demoErrorMessage(e, this.translate);
      },
    });
  }

  /**
   * On narrow screens Send sits in the footer at the bottom while the page error is at the
   * top (and field errors are mid-page) — bring the first message into view so the click
   * doesn't look like it did nothing.
   */
  private scrollToFirstError(): void {
    scrollToFirstError(this.host.nativeElement, this.injector);
  }

  /**
   * Only what the admin changed is sent; a field left out keeps the saved value.
   * "" = back to the default subject / the standard invitation. Subject and files only for Email.
   */
  private resendBody(): ResendDemoRequest {
    const inv = this.invitation;
    const body: ResendDemoRequest = {};
    // A "None" account always differs, so its channel is always sent.
    if (this.account && this.channel !== this.account.channel) body.channel = this.channel;
    if (this.needsContact) {
      if (this.isEmail) body.email = this.email.trim();
      else body.phoneNumber = normalizePhoneInput(this.phoneNumber);
    }
    if (inv.messageChanged) body.invitationMessage = inv.message.trim() ? inv.message : '';
    if (inv.languageChanged) body.invitationLanguage = inv.language;
    if (this.isEmail) {
      if (inv.subjectChanged) body.invitationSubject = inv.subject.trim() ? inv.subject : '';
      if (this.attachments?.touched) body.attachmentIds = this.attachments.ids; // full list; [] removes all
    }
    return body;
  }

  /** The new PIN, code and message are shown once; closing opens the account page (replacing this form). */
  private showCredentials(result: DemoResendResult): void {
    const { pin, verificationCode, renderedMessage, ...account } = result;
    // 200 even when delivery failed — the newest attempt says whether it arrived.
    const sent = account.deliveries?.[0]?.succeeded === true;
    const recipient = account.channel === 'Email' ? account.email : toLocalPhone(account.contactPhone);
    this.dialog.open(CredentialsDialogComponent, {
      width: '560px',
      maxWidth: '94vw',
      disableClose: true,
      direction: this.dir,
      data: {
        credentials: {
          account: account as DemoAccount,
          pin: pin ?? '',
          verificationCode,
          renderedMessage,
          invitationSent: sent,
          reopened: false,
        },
        mode: 'resend',
        recipient,
      } as CredentialsDialogData,
    }).afterClosed().subscribe(() => this.goToDetails(true));
  }

  /** Not found → back to the list; disabled meanwhile → its page. Returns true when handled. */
  private handlePageError(e: DemoApiError): boolean {
    if (e.code === 'DEMO_ACCOUNT_NOT_FOUND' || (!e.code && e.status === 404)) {
      this.toastr.error(this.translate.instant('d3.demoAccounts.errors.DEMO_ACCOUNT_NOT_FOUND'));
      this.router.navigate(['/', this.lang, 'd3', 'demo-accounts']);
      return true;
    }
    if (e.code && DEMO_PAGE_LEVEL_CODES.has(e.code)) {
      this.toastr.error(demoErrorMessage(e, this.translate));
      this.goToDetails();
      return true;
    }
    return false;
  }

  private goToDetails(replaceUrl = false): void {
    this.router.navigate(['/', this.lang, 'd3', 'demo-accounts', this.id], { replaceUrl });
  }
}
