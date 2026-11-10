import { Component, OnDestroy, OnInit, ViewChild, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { LoginService } from '../../../services/login/login.service';
import { DemoAccountsService } from '../../../services/demo-accounts.service';
import { PageTitleOverrideService } from '../../../services/page-title-override.service';
import {
  DEMO_CHANNELS,
  DEMO_CHANNEL_ICONS,
  DEMO_PERMISSIONS,
  DemoAccount,
  DemoChannel,
  ResendDemoRequest
} from '../../../interfaces/demo-account.model';
import { DEMO_FIELD_ALIASES, DemoApiError, demoActionToast, demoErrorMessage, readDemoError } from '../demo-accounts.util';
import { DEMO_PAGE_LEVEL_CODES } from '../components/demo-action-dialog/demo-action-dialog.component';
import { DemoAttachmentsComponent } from '../components/demo-attachments/demo-attachments.component';
import { InvitationEditorStore } from '../components/invitation-editor/invitation-editor.store';
import { InvitationEditorComponent } from '../components/invitation-editor/invitation-editor.component';
import { InvitationPreviewComponent } from '../components/invitation-editor/invitation-preview.component';

// /demo-accounts/:id/resend — pick the channel, edit the saved invitation and send it
// again. Every resend issues a new PIN the admin never sees.
@Component({
  selector: 'app-demo-account-resend',
  standalone: true,
  imports: [
    CommonModule, MatTooltipModule, TablerIconsModule, TranslateModule,
    DemoAttachmentsComponent, InvitationEditorComponent, InvitationPreviewComponent,
  ],
  providers: [InvitationEditorStore],
  templateUrl: './demo-account-resend.component.html',
  styleUrl: './demo-account-resend.component.scss'
})
export class DemoAccountResendComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(DemoAccountsService);
  private readonly translate = inject(TranslateService);
  private readonly toastr = inject(ToastrService);
  private readonly login = inject(LoginService);
  private readonly pageTitle = inject(PageTitleOverrideService);
  readonly invitation = inject(InvitationEditorStore);

  @ViewChild(DemoAttachmentsComponent) private attachments?: DemoAttachmentsComponent;

  readonly canManage = computed(() =>
    this.login.permissions().some(p => p.toLowerCase() === DEMO_PERMISSIONS.manage)
  );

  readonly channels = DEMO_CHANNELS;
  readonly channelIcons = DEMO_CHANNEL_ICONS;
  readonly lang = this.translate.currentLang || 'ar';

  id = '';
  account: DemoAccount | null = null;
  channel: DemoChannel = 'Email';
  loading = true;
  loadError: string | null = null;

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
      && !this.invitation.blocked && this.hasContact(this.channel);
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
        this.channel = account.channel;
        this.pageTitle.set(account.fullName);
        // The preview uses this account's real values.
        this.invitation.init({
          channel: account.channel,
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

  noContactTip(channel: DemoChannel): string {
    if (this.hasContact(channel)) return '';
    return this.translate.instant(channel === 'Email'
      ? 'd3.demoAccounts.dialogs.resend.noEmail'
      : 'd3.demoAccounts.dialogs.resend.noPhone');
  }

  setChannel(channel: DemoChannel): void {
    if (this.submitting || !this.hasContact(channel)) return;
    this.channel = channel;
    this.invitation.setChannel(channel);
    this.error = null;
  }

  // ── Send ──────────────────────────────────────────────────

  cancel(): void {
    if (this.submitting) return;
    this.goToDetails(); // the leave guard asks first when something changed
  }

  submit(): void {
    if (!this.canSubmit || !this.account) return;
    this.error = null;
    this.attachments?.setError(null);
    this.submitting = true;

    this.service.resend(this.account.id, this.resendBody()).subscribe({
      next: account => {
        this.submitting = false;
        // 200 even when delivery failed — the toast reads deliveries[0].succeeded.
        const toast = demoActionToast('resend', account, this.translate, this.lang);
        if (toast) toast.ok ? this.toastr.success(toast.message) : this.toastr.error(toast.message);
        this.goToDetails(true);
      },
      error: err => {
        this.submitting = false;
        const e = readDemoError(err);
        if (this.handlePageError(e)) return;
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
   * Only what the admin changed is sent; a field left out keeps the saved value.
   * "" = back to the default subject / the standard invitation. Subject and files only for Email.
   */
  private resendBody(): ResendDemoRequest {
    const inv = this.invitation;
    const body: ResendDemoRequest = {};
    if (this.account && this.channel !== this.account.channel) body.channel = this.channel;
    if (inv.messageChanged) body.invitationMessage = inv.message.trim() ? inv.message : '';
    if (inv.languageChanged) body.invitationLanguage = inv.language;
    if (this.isEmail) {
      if (inv.subjectChanged) body.invitationSubject = inv.subject.trim() ? inv.subject : '';
      if (this.attachments?.touched) body.attachmentIds = this.attachments.ids; // full list; [] removes all
    }
    return body;
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
