import { Component, ElementRef, Injector, OnInit, ViewChild, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Clipboard } from '@angular/cdk/clipboard';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { LoginService } from '../../../../services/login/login.service';
import { DemoSignupLinksService } from '../../../../services/demo-signup-links.service';
import {
  DEFAULT_DEMO_KIND,
  DEMO_KINDS,
  DEMO_KIND_ICONS,
  DEMO_LIMITS,
  DEMO_PERMISSIONS,
  DemoAccountKind,
  DemoChannel
} from '../../../../interfaces/demo-account.model';
import { DEMO_SIGNUP_LIMITS, DemoSignupBatch, DemoSignupChannels, DemoSignupLink } from '../../../../interfaces/demo-signup-link.model';
import { DEMO_FIELD_ALIASES, formatRiyadhDate, readDemoError } from '../../demo-accounts.util';
import { scrollToFirstError } from '../../scroll-to-error';
import { DemoTabsComponent } from '../../components/demo-tabs/demo-tabs.component';
import { DemoAttachmentsComponent } from '../../components/demo-attachments/demo-attachments.component';
import { InvitationEditorStore } from '../../components/invitation-editor/invitation-editor.store';
import { InvitationEditorComponent } from '../../components/invitation-editor/invitation-editor.component';
import { InvitationPreviewComponent } from '../../components/invitation-editor/invitation-preview.component';
import { SignupChannelsBarComponent } from '../components/signup-channels-bar.component';
import { shortLink, signupErrorMessage, signupLinkUrl } from '../demo-signup-links.util';

type Field = 'count' | 'durationDays' | 'linkValidDays' | 'note';
const FIELDS: Field[] = ['count', 'durationDays', 'linkValidDays', 'note'];
const EXTRA_FIELDS: Field[] = ['linkValidDays', 'note'];

// /demo-accounts/signup-links/new — "Demo sign-up links": channel status on top, then the
// form (count, kind, trial days, message; extra settings folded), the live preview on the
// end side, and after 201 the new links with copy buttons.
@Component({
  selector: 'app-signup-links-create',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TablerIconsModule, TranslateModule, DemoTabsComponent,
    DemoAttachmentsComponent, InvitationEditorComponent, InvitationPreviewComponent, SignupChannelsBarComponent,
  ],
  providers: [InvitationEditorStore],
  templateUrl: './signup-links-create.component.html',
  styleUrls: ['../../demo-account-create/demo-account-create.component.scss', './signup-links-create.component.scss']
})
export class SignupLinksCreateComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly service = inject(DemoSignupLinksService);
  private readonly translate = inject(TranslateService);
  private readonly toastr = inject(ToastrService);
  private readonly login = inject(LoginService);
  private readonly clipboard = inject(Clipboard);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  readonly invitation = inject(InvitationEditorStore);

  @ViewChild(DemoAttachmentsComponent) private attachments?: DemoAttachmentsComponent;

  readonly canManage = computed(() =>
    this.login.permissions().some(p => p.toLowerCase() === DEMO_PERMISSIONS.manage)
  );

  readonly lang = this.translate.currentLang || 'ar';
  readonly kinds = DEMO_KINDS;
  readonly kindIcons = DEMO_KIND_ICONS;
  readonly limits = DEMO_LIMITS;
  readonly linkLimits = DEMO_SIGNUP_LIMITS;
  /**
   * The preview shows only what a person can really pick on the sign-up page (the ready
   * channels). Both until GET channels answers.
   */
  previewTabs: DemoChannel[] = ['Sms', 'Email'];
  readonly dayPresets = [7, 14, 30, 60].filter(d => d >= DEMO_LIMITS.minDays && d <= DEMO_LIMITS.maxDays);
  /** Quick picks for the number of links. */
  readonly countPresets = [1, 5, 10, 25, 50].filter(n => n >= DEMO_SIGNUP_LIMITS.minCount && n <= DEMO_SIGNUP_LIMITS.maxCount);
  /** The flow shown under the title: links first, an account only once someone signs up. */
  readonly steps = [
    { key: 'create', icon: 'link-plus' },
    { key: 'share', icon: 'share' },
    { key: 'signup', icon: 'user-check' },
    { key: 'track', icon: 'list-details' },
  ];
  readonly shortLink = shortLink;

  count: number | null = DEMO_SIGNUP_LIMITS.defaultCount;
  kind: DemoAccountKind = DEFAULT_DEMO_KIND;
  durationDays: number | null = DEMO_LIMITS.defaultDays;
  linkValidDays: number | null = DEMO_SIGNUP_LIMITS.defaultLinkDays;
  note = '';
  /** Numbered sections, like the demo-account create page; "Extra settings" starts folded. */
  open = { links: true, message: true };
  extrasOpen = false;

  /** null until GET channels answers. */
  channels: DemoSignupChannels | null = null;
  channelsChecked = false;
  /** DEMO_SIGNUP_DISABLED (from channels or create). */
  featureDisabled = false;

  submitting = false;
  formError: string | null = null;
  errors: Partial<Record<Field, string | null>> = {};
  private readonly touched = new Set<Field>();

  /** The answer of the last create — the page then shows the new links. */
  batch: DemoSignupBatch | null = null;
  copiedId: string | null = null;

  ngOnInit(): void {
    if (!this.canManage()) {
      this.toastr.error(this.translate.instant('d3.demoAccounts.errors.forbidden'));
      this.goToList();
      return;
    }
    // Email so the subject is part of the preview; the preview shows the SMS and Email tabs.
    this.invitation.typedValues = () => ({ days: Number(this.durationDays) || undefined });
    this.invitation.init({ channel: 'Email', kind: this.kind });
    this.invitation.attachmentIds = () => this.attachments?.ids ?? [];
  }

  // ── Channels ──────────────────────────────────────────────

  onChannels(c: DemoSignupChannels | null): void {
    this.channels = c;
    this.channelsChecked = true;
    if (!c?.anyReady) {
      this.previewTabs = ['Sms', 'Email'];
      return;
    }
    const ready: DemoChannel[] = [];
    if (c.sms?.ready) ready.push('Sms');
    if (c.email?.ready) ready.push('Email');
    this.previewTabs = ready;
    // The editor shows the subject only for Email; with Email off it follows SMS.
    this.invitation.setChannel(c.email?.ready ? 'Email' : 'Sms');
  }

  /** Subject and files go only by email — hidden when email can't send. Unknown = shown. */
  get emailReady(): boolean {
    return !this.channels?.anyReady || !!this.channels.email?.ready;
  }

  onChannelsFailed(code: string | null): void {
    if (code === 'DEMO_SIGNUP_DISABLED') this.featureDisabled = true;
  }

  /** anyReady = false → nothing can be sent, so no link can work. */
  get noChannel(): boolean {
    return !!this.channels && !this.channels.anyReady;
  }

  get canSubmit(): boolean {
    return !this.submitting && !this.featureDisabled && !this.noChannel && !!this.channels
      && !this.attachments?.uploading && !this.invitation.blocked;
  }

  // ── Form ──────────────────────────────────────────────────

  setKind(kind: DemoAccountKind): void {
    if (this.submitting || kind === this.kind) return;
    this.kind = kind;
    this.formError = null;
    this.invitation.setKind(kind);
  }

  setCount(n: number): void {
    if (this.submitting) return;
    this.count = n;
    this.onBlur('count');
  }

  /** "Create 3 links" — the button says what will be made; plain "Create links" while the count is invalid. */
  get submitLabel(): string {
    const n = Number(this.count);
    return this.validate('count')
      ? this.translate.instant('d3.demoAccounts.signupLinks.create.submit')
      : this.translate.instant(n === 1 ? 'd3.demoAccounts.signupLinks.create.submitOne' : 'd3.demoAccounts.signupLinks.create.submitCount', { count: n });
  }

  setDays(days: number): void {
    if (this.submitting) return;
    this.durationDays = days;
    this.onBlur('durationDays');
    this.invitation.refresh();
  }

  step(field: 'count' | 'durationDays' | 'linkValidDays', delta: number): void {
    if (this.submitting) return;
    const [min, max, def] = this.range(field);
    const current = Number(this[field]) || def;
    this[field] = Math.min(max, Math.max(min, current + delta));
    this.onBlur(field);
    if (field === 'durationDays') this.invitation.refresh();
  }

  onBlur(field: Field): void {
    this.touched.add(field);
    this.errors[field] = this.validate(field);
  }

  onInput(field: Field): void {
    if (this.touched.has(field)) this.errors[field] = this.validate(field);
    if (field === 'durationDays') this.invitation.refresh();
  }

  /** ③ holds the link validity, the note, the files and the email subject. */
  get extrasHaveErrors(): boolean {
    return EXTRA_FIELDS.some(f => this.errors[f]) || !!this.attachments?.error || this.subjectHasErrors;
  }

  get subjectHasErrors(): boolean {
    const inv = this.invitation;
    return !inv.previewLoading && (inv.issues('Subject').length > 0 || !!inv.fieldErrors.subject);
  }

  get linksHaveErrors(): boolean {
    return !!(this.errors.count || this.errors.durationDays);
  }

  /** ② = the message and its language; a subject problem marks ③ instead. */
  get messageHasErrors(): boolean {
    const inv = this.invitation;
    const messageIssues = !inv.previewLoading && inv.issues('Message').length > 0;
    return messageIssues || !!(inv.fieldErrors.message || inv.fieldErrors.language);
  }

  /** Folded ① header: links · kind · days. */
  get linksSummary(): string {
    const t = (k: string) => this.translate.instant(k);
    return [
      `${Number(this.count) || 0} ${t('d3.demoAccounts.signupLinks.filters.linksUnit')}`,
      t(`d3.demoAccounts.kinds.${this.kind}`),
      `${Number(this.durationDays) || 0} ${t('d3.demoAccounts.dayUnit')}`,
    ].join(' · ');
  }

  /** Folded ② header: the message's first line, else "standard invitation". */
  get messageSummary(): string {
    return this.invitation.message.trim().split('\n')[0]
      || this.translate.instant('d3.demoAccounts.standardInvitation');
  }

  /** Folded ③ header: link validity · files. */
  get extrasSummary(): string {
    const days = `${this.translate.instant('d3.demoAccounts.signupLinks.create.linkValidShort')} ${Number(this.linkValidDays) || 0} ${this.translate.instant('d3.demoAccounts.dayUnit')}`;
    const files = this.attachments?.ids.length ?? 0;
    return files
      ? `${days} · ${this.translate.instant('d3.demoAccounts.signupLinks.create.filesCount', { count: files })}`
      : days;
  }

  /** The trial's last day for a person who signs up today. */
  get endDate(): Date | null {
    const days = Number(this.durationDays);
    if (this.validate('durationDays')) return null;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

  /** The day the links stop working if made now. */
  get linksEndDate(): Date | null {
    if (this.validate('linkValidDays')) return null;
    const d = new Date();
    d.setDate(d.getDate() + Number(this.linkValidDays));
    return d;
  }

  submit(): void {
    if (!this.canSubmit) return;
    FIELDS.forEach(f => this.touched.add(f));
    FIELDS.forEach(f => (this.errors[f] = this.validate(f)));
    this.formError = null;
    if (FIELDS.some(f => this.errors[f])) {
      this.focusError();
      return;
    }

    const { message, language } = this.invitation;
    // Subject and files are email-only: not sent while email is off.
    const subject = this.emailReady ? this.invitation.subject : '';
    const attachmentIds = this.emailReady ? (this.attachments?.ids ?? []) : [];
    this.submitting = true;
    this.attachments?.setError(null);

    this.service.create({
      count: Number(this.count),
      kind: this.kind,
      durationDays: Number(this.durationDays),
      linkValidDays: Number(this.linkValidDays),
      // Empty = the server's standard invitation. Sent exactly as typed.
      ...(message.trim() ? { invitationMessage: message } : {}),
      invitationLanguage: language,
      ...(subject.trim() ? { invitationSubject: subject } : {}),
      // Sent only to people who choose Email.
      ...(attachmentIds.length ? { attachmentIds } : {}),
      ...(this.note.trim() ? { note: this.note.trim() } : {}),
    }).subscribe({
      next: batch => {
        this.submitting = false;
        this.batch = batch;
        this.toastr.success(this.translate.instant('d3.demoAccounts.signupLinks.create.created', { count: batch?.links?.length ?? batch?.totalLinks ?? 0 }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: err => {
        this.submitting = false;
        const e = readDemoError(err);

        if (e.code === 'DEMO_SIGNUP_DISABLED') this.featureDisabled = true;

        // The text has an unknown variable → a fresh preview marks it (fieldErrors too).
        if (this.invitation.handleError(e)) {
          this.invitation.takeFieldErrors(e.fieldErrors);
          // A subject problem lives in ③, a message problem in ②.
          if (e.code === 'DEMO_SUBJECT_INVALID') this.extrasOpen = true;
          else this.open.message = true;
          this.formError = signupErrorMessage(e, this.translate);
          return;
        }
        if (e.code?.startsWith('DEMO_ATTACHMENT')) {
          this.extrasOpen = true;
          this.attachments?.setError(signupErrorMessage(e, this.translate));
          return;
        }
        const fieldOf: Record<string, Field> = {
          DEMO_SIGNUP_COUNT_INVALID: 'count',
          DEMO_DURATION_INVALID: 'durationDays',
          DEMO_SIGNUP_LINK_DAYS_INVALID: 'linkValidDays',
        };
        if (e.code && fieldOf[e.code]) {
          this.errors[fieldOf[e.code]] = signupErrorMessage(e, this.translate);
          this.focusError();
          return;
        }
        if (e.code === 'VALIDATION_ERROR' && e.fieldErrors.length) {
          const unplaced: string[] = [];
          for (const fe of this.invitation.takeFieldErrors(e.fieldErrors)) {
            const name = fe.field ? (DEMO_FIELD_ALIASES[fe.field] ?? fe.field) : null;
            if (name === 'attachments') { this.extrasOpen = true; this.attachments?.setError(fe.message); continue; }
            const field = FIELDS.find(f => f.toLowerCase() === name);
            if (field) this.errors[field] = fe.message;
            else unplaced.push(fe.message);
          }
          this.formError = unplaced.length ? unplaced.join(' - ') : null;
          this.focusError();
          return;
        }
        // DEMO_SIGNUP_NO_CHANNEL_READY / DEMO_SIGNUP_DISABLED / anything else: the server's sentence.
        this.formError = signupErrorMessage(e, this.translate);
        this.focusError();
      },
    });
  }

  // ── Result: the new links ─────────────────────────────────

  get links(): DemoSignupLink[] {
    return this.batch?.links ?? [];
  }

  url(link: DemoSignupLink): string | null {
    return signupLinkUrl(link);
  }

  /** Some link had no url and none could be built (PageUrl missing on the server and here). */
  get missingUrls(): boolean {
    return this.links.some(l => !signupLinkUrl(l));
  }

  copy(link: DemoSignupLink): void {
    const value = signupLinkUrl(link) ?? link.code;
    if (!this.clipboard.copy(value)) {
      this.toastr.error(this.translate.instant('d3.demoAccounts.copyFailed'));
      return;
    }
    this.copiedId = link.id;
    setTimeout(() => { if (this.copiedId === link.id) this.copiedId = null; }, 1500);
  }

  /** Every link, one per line. */
  copyAll(): void {
    const text = this.links.map(l => signupLinkUrl(l) ?? l.code).join('\n');
    if (!text || !this.clipboard.copy(text)) {
      this.toastr.error(this.translate.instant('d3.demoAccounts.copyFailed'));
      return;
    }
    this.toastr.success(this.translate.instant('d3.demoAccounts.signupLinks.create.copiedAll', { count: this.links.length }));
  }

  date(value: string | null | undefined): string {
    return formatRiyadhDate(value, this.lang, true) ?? '—';
  }

  /** Opens the tracking table on this batch. */
  track(): void {
    this.router.navigate(['/', this.lang, 'd3', 'demo-accounts', 'signup-links'],
      { queryParams: this.batch ? { batchId: this.batch.id } : {} });
  }

  /** Back to an empty form for another batch (same settings kept). */
  again(): void {
    this.batch = null;
    this.copiedId = null;
  }

  goToList(): void {
    this.router.navigate(['/', this.lang, 'd3', 'demo-accounts', 'signup-links']);
  }

  // ── Validation ────────────────────────────────────────────

  private range(field: 'count' | 'durationDays' | 'linkValidDays'): [number, number, number] {
    switch (field) {
      case 'count': return [DEMO_SIGNUP_LIMITS.minCount, DEMO_SIGNUP_LIMITS.maxCount, DEMO_SIGNUP_LIMITS.defaultCount];
      case 'durationDays': return [DEMO_LIMITS.minDays, DEMO_LIMITS.maxDays, DEMO_LIMITS.defaultDays];
      default: return [DEMO_SIGNUP_LIMITS.minLinkDays, DEMO_SIGNUP_LIMITS.maxLinkDays, DEMO_SIGNUP_LIMITS.defaultLinkDays];
    }
  }

  private validate(field: Field): string | null {
    const t = (key: string, params?: object) => this.translate.instant(`d3.demoAccounts.signupLinks.validation.${key}`, params);
    if (field === 'note') {
      return this.note.length > DEMO_LIMITS.note ? this.translate.instant('d3.demoAccounts.validation.noteMax') : null;
    }
    const [min, max] = this.range(field);
    const v = Number(this[field]);
    const ok = this[field] !== null && Number.isInteger(v) && v >= min && v <= max;
    return ok ? null : t(field, { min, max });
  }

  private focusError(): void {
    if (this.linksHaveErrors) this.open.links = true;
    if (this.messageHasErrors) this.open.message = true;
    if (this.extrasHaveErrors) this.extrasOpen = true;
    scrollToFirstError(this.host.nativeElement, this.injector);
  }
}
