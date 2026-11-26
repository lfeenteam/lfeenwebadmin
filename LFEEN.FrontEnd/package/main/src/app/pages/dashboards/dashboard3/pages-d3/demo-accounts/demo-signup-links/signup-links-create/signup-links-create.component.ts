import { Component, ElementRef, Injector, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Clipboard } from '@angular/cdk/clipboard';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { AppPluralPipe, translatePlural } from 'src/app/pipes/app-plural.pipe';
import { LoginService } from '../../../../services/login/login.service';
import { DemoSignupLinksService } from '../../../../services/demo-signup-links.service';
import {
  DEFAULT_DEMO_KIND,
  DEMO_KINDS,
  DEMO_KIND_ICONS,
  DEMO_LIMITS,
  DEMO_PERMISSIONS,
  DemoAccountKind
} from '../../../../interfaces/demo-account.model';
import {
  DEMO_SIGNUP_LIMITS,
  DEMO_SIGNUP_TEXT_FORBIDDEN,
  DemoSignupBatch,
  DemoSignupLink
} from '../../../../interfaces/demo-signup-link.model';
import { DEMO_FIELD_ALIASES, formatRiyadhDate, readDemoError } from '../../demo-accounts.util';
import { scrollToFirstError } from '../../scroll-to-error';
import { DemoTabsComponent } from '../../components/demo-tabs/demo-tabs.component';
import { InvitationEditorStore } from '../../components/invitation-editor/invitation-editor.store';
import { InvitationEditorComponent } from '../../components/invitation-editor/invitation-editor.component';
import { SignupPagePreviewComponent } from '../components/signup-page-preview.component';
import { countText, signupErrorMessage, signupLinkUrl } from '../demo-signup-links.util';

type Field = 'count' | 'durationDays' | 'area' | 'additionalNotes' | 'linkValidDays';
const FIELDS: Field[] = ['count', 'durationDays', 'area', 'additionalNotes', 'linkValidDays'];
const LINKS_FIELDS: Field[] = ['count', 'durationDays'];
const META_FIELDS: Field[] = ['area', 'additionalNotes'];

/** Server codes that belong to one field (shown under it). */
const FIELD_OF_CODE: Record<string, Field> = {
  DEMO_SIGNUP_COUNT_INVALID: 'count',
  DEMO_DURATION_INVALID: 'durationDays',
  DEMO_SIGNUP_LINK_DAYS_INVALID: 'linkValidDays',
  DEMO_SIGNUP_AREA_INVALID: 'area',
  DEMO_SIGNUP_NOTES_INVALID: 'additionalNotes',
};

// /demo-accounts/signup-links/new — "Create demo links" (guide §4). Nothing is sent: the first time
// a link is opened its account ("حساب تجريبي") is created and the sign-in data shows on the link's
// page. ① links (count, kind, trial) · ② who it's for (area + notes, admin only) · ③ welcome message ·
// ④ link validity, folded. The end side previews the page the organisation sees.
@Component({
  selector: 'app-signup-links-create',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, DemoTabsComponent, InvitationEditorComponent, SignupPagePreviewComponent, AppPluralPipe],
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

  readonly canManage = computed(() =>
    this.login.permissions().some(p => p.toLowerCase() === DEMO_PERMISSIONS.manage)
  );

  /** Follows the sidebar language switch (the route reuses this component, so it isn't re-created). */
  lang = this.translate.currentLang || 'ar';
  readonly kinds = DEMO_KINDS;
  readonly kindIcons = DEMO_KIND_ICONS;
  readonly limits = DEMO_LIMITS;
  readonly linkLimits = DEMO_SIGNUP_LIMITS;
  readonly dayPresets = [7, 14, 30, 60].filter(d => d >= DEMO_LIMITS.minDays && d <= DEMO_LIMITS.maxDays);
  readonly countPresets = [1, 5, 10, 25, 50].filter(n => n >= DEMO_SIGNUP_LIMITS.minCount && n <= DEMO_SIGNUP_LIMITS.maxCount);
  /** The flow under the title: the link is the key — the account exists only once it is opened. */
  readonly steps = [
    { key: 'create', icon: 'link-plus' },
    { key: 'send', icon: 'send' },
    { key: 'open', icon: 'id-badge-2' },
    { key: 'track', icon: 'list-details' },
  ];

  count: number | null = DEMO_SIGNUP_LIMITS.defaultCount;
  kind: DemoAccountKind = DEFAULT_DEMO_KIND;
  durationDays: number | null = DEMO_LIMITS.defaultDays;
  area = '';
  additionalNotes = '';
  linkValidDays: number | null = DEMO_SIGNUP_LIMITS.defaultLinkDays;

  /** Numbered sections like the demo-account create page; ④ (link validity) starts folded. */
  open = { links: true, meta: true, welcome: true, extras: false };

  /** DEMO_SIGNUP_DISABLED from the last create. */
  featureDisabled = false;
  submitting = false;
  formError: string | null = null;
  errors: Partial<Record<Field, string | null>> = {};
  private readonly touched = new Set<Field>();

  /** The answer of the last create — the page then shows the new links. */
  batch: DemoSignupBatch | null = null;
  copiedId: string | null = null;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed())
      .subscribe(event => { this.lang = event.lang; });
  }

  get dir(): 'rtl' | 'ltr' {
    return this.lang === 'en' ? 'ltr' : 'rtl';
  }

  ngOnInit(): void {
    if (!this.canManage()) {
      this.toastr.error(this.translate.instant('d3.demoAccounts.errors.forbidden'));
      this.goToList();
      return;
    }
    // The welcome text shows on the link's page — not an email, so no subject. WhatsApp is the
    // plain-text rendering the page preview reads. Every account is called "حساب تجريبي", and the
    // area / notes never reach the organisation, so {{name}} is always that.
    this.invitation.typedValues = () => ({
      name: this.translate.instant('d3.demoAccounts.signupLinks.preview.defaultName'),
      days: Number(this.durationDays) || undefined,
    });
    this.invitation.init({ channel: 'WhatsApp', kind: this.kind });
  }

  get canSubmit(): boolean {
    return !this.submitting && !this.featureDisabled && !this.invitation.blocked;
  }

  /** "Create 3 links" — the button says what will be made. */
  get submitLabel(): string {
    if (this.validate('count')) return this.translate.instant('d3.demoAccounts.signupLinks.create.submit');
    return this.translate.instant('d3.demoAccounts.signupLinks.create.submitCount', {
      links: countText(Number(this.count), 'link', this.translate),
    });
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

  get linksHaveErrors(): boolean {
    return LINKS_FIELDS.some(f => this.errors[f]);
  }

  get metaHasErrors(): boolean {
    return META_FIELDS.some(f => this.errors[f]);
  }

  get welcomeHasErrors(): boolean {
    const inv = this.invitation;
    const messageIssues = !inv.previewLoading && inv.issues('Message').length > 0;
    return messageIssues || !!(inv.fieldErrors.message || inv.fieldErrors.language);
  }

  get extrasHaveErrors(): boolean {
    return !!this.errors.linkValidDays;
  }

  /** Folded ① header: links · kind · days. */
  get linksSummary(): string {
    const t = (k: string) => this.translate.instant(k);
    return [
      countText(Number(this.count) || 0, 'link', this.translate),
      t(`d3.demoAccounts.kinds.${this.kind}`),
      translatePlural(this.translate, 'd3.demoAccounts.days', Number(this.durationDays) || 0),
    ].join(' · ');
  }

  /** Folded ② header: area · notes. */
  get metaSummary(): string {
    const area = this.area.trim() || this.translate.instant('d3.demoAccounts.signupLinks.create.noArea');
    return this.additionalNotes.trim()
      ? `${area} · ${this.translate.instant('d3.demoAccounts.signupLinks.create.hasNotes')}`
      : area;
  }

  /** Folded ③ header: the message's first line, else "standard welcome message". */
  get welcomeSummary(): string {
    return this.invitation.message.trim().split('\n')[0]
      || this.translate.instant('d3.demoAccounts.signupLinks.create.standardWelcome');
  }

  /** Folded ④ header: the first-open window. */
  get extrasSummary(): string {
    return this.translate.instant('d3.demoAccounts.signupLinks.create.linkValidSummary', { days: Number(this.linkValidDays) || 0 });
  }

  /** The day the links can no longer be opened for the first time, if made now. */
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
    this.submitting = true;

    this.service.create({
      count: Number(this.count),
      kind: this.kind,
      durationDays: Number(this.durationDays),
      linkValidDays: Number(this.linkValidDays),
      ...(this.area.trim() ? { area: this.area.trim() } : {}),
      ...(this.additionalNotes.trim() ? { additionalNotes: this.additionalNotes.trim() } : {}),
      // Empty = the standard welcome text. Sent exactly as typed.
      ...(message.trim() ? { invitationMessage: message } : {}),
      invitationLanguage: language,
    }).subscribe({
      next: batch => {
        this.submitting = false;
        this.batch = batch;
        const made = batch?.links?.length ?? batch?.totalLinks ?? 0;
        this.toastr.success(this.translate.instant('d3.demoAccounts.signupLinks.create.created', {
          links: countText(made, 'link', this.translate),
        }));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: err => {
        this.submitting = false;
        const e = readDemoError(err);

        if (e.code === 'DEMO_SIGNUP_DISABLED') this.featureDisabled = true;

        // An unknown variable in the welcome text → a fresh preview marks it.
        if (this.invitation.handleError(e)) {
          this.invitation.takeFieldErrors(e.fieldErrors);
          this.open.welcome = true;
          this.formError = signupErrorMessage(e, this.translate);
          return;
        }
        if (e.code && FIELD_OF_CODE[e.code]) {
          this.errors[FIELD_OF_CODE[e.code]] = signupErrorMessage(e, this.translate);
          this.focusError();
          return;
        }
        if (e.code === 'VALIDATION_ERROR' && e.fieldErrors.length) {
          const unplaced: string[] = [];
          for (const fe of this.invitation.takeFieldErrors(e.fieldErrors)) {
            const name = fe.field ? (DEMO_FIELD_ALIASES[fe.field] ?? fe.field) : null;
            const field = FIELDS.find(f => f.toLowerCase() === name);
            if (field) this.errors[field] = fe.message;
            else unplaced.push(fe.message);
          }
          this.formError = unplaced.length ? unplaced.join(' - ') : null;
          this.focusError();
          return;
        }
        // DEMO_SIGNUP_PIN_KEY_MISSING / DEMO_SIGNUP_DISABLED / anything else: the server's sentence.
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

  /** A link with no url that can't be built here either (PageUrl missing). */
  get missingUrls(): boolean {
    return this.links.some(l => !signupLinkUrl(l));
  }

  get resultTitle(): string {
    return this.translate.instant('d3.demoAccounts.signupLinks.create.resultTitle', {
      links: countText(this.links.length, 'link', this.translate),
    });
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
    this.toastr.success(this.translate.instant('d3.demoAccounts.signupLinks.create.copiedAll', {
      links: countText(this.links.length, 'link', this.translate),
    }));
  }

  date(value: string | null | undefined): string {
    return formatRiyadhDate(value, this.lang, true) ?? '—';
  }

  /** Opens the tracking table on this batch. */
  track(): void {
    this.router.navigate(['/', this.lang, 'd3', 'demo-accounts', 'signup-links'],
      { queryParams: this.batch ? { batchId: this.batch.id } : {} });
  }

  /** Back to the form for another batch (same settings kept). */
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
    if (field === 'area' || field === 'additionalNotes') {
      const v = this[field].trim();
      if (v.length > DEMO_SIGNUP_LIMITS[field]) return t(`${field}Max`, { max: DEMO_SIGNUP_LIMITS[field] });
      return DEMO_SIGNUP_TEXT_FORBIDDEN.test(v) ? t('textChars') : null;
    }
    const [min, max] = this.range(field);
    const v = Number(this[field]);
    const ok = this[field] !== null && Number.isInteger(v) && v >= min && v <= max;
    return ok ? null : t(field, { min, max });
  }

  private focusError(): void {
    if (this.linksHaveErrors) this.open.links = true;
    if (this.metaHasErrors) this.open.meta = true;
    if (this.welcomeHasErrors) this.open.welcome = true;
    if (this.extrasHaveErrors) this.open.extras = true;
    scrollToFirstError(this.host.nativeElement, this.injector);
  }
}
