import { Injectable, OnDestroy, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subject, Subscription, catchError, debounceTime, map, of, switchMap, tap } from 'rxjs';
import { DemoAccountsService } from '../../../../services/demo-accounts.service';
import {
  DemoChannel,
  InvitationField,
  InvitationIssue,
  InvitationLanguage,
  InvitationPreset,
  InvitationPreview,
  InvitationPreviewRequest,
  InvitationTemplates,
  InvitationVariable
} from '../../../../interfaces/demo-account.model';
import { DemoApiError, DemoFieldError, demoErrorMessage, readDemoError } from '../../demo-accounts.util';

/** Codes that mean "the text has a problem": ask for a preview and show its issues. */
const TEXT_INVALID_CODES = new Set(['DEMO_SUBJECT_INVALID', 'DEMO_MESSAGE_INVALID', 'DEMO_INVITATION_TEMPLATE_INVALID']);

const PREVIEW_DEBOUNCE_MS = 500;

/** Values typed on the create page, shown in the preview instead of the server's examples. */
export interface InvitationTypedValues {
  name?: string;
  days?: number;
}

/** One {{token}} swapped for a typed value: its range before (o*) and after (n*) the swap. */
interface TokenEdit { oStart: number; oEnd: number; nStart: number; nEnd: number; }

interface FilledText { text: string; edits: TokenEdit[]; }

const TOKEN_PATTERN = /\{\{\s*([^{}\s]+)\s*\}\}/g;

/** Maps a position in the filled text back to the text the admin typed. */
function toOriginal(pos: number, edits: TokenEdit[], isEnd: boolean): number {
  let delta = 0;
  for (const e of edits) {
    if (pos <= e.nStart) break;
    if (pos < e.nEnd) return isEnd ? e.oEnd : e.oStart; // inside a swapped value → the whole token
    delta += (e.oEnd - e.oStart) - (e.nEnd - e.nStart);
  }
  return pos + delta;
}

// State of one invitation editor (create or resend): the texts, the editor data from
// GET /invitation-templates and the live preview from POST /invitation-preview.
// Provided by the dialog, so the editor fields and the preview panel share it.
@Injectable()
export class InvitationEditorStore implements OnDestroy {
  private readonly service = inject(DemoAccountsService);
  private readonly translate = inject(TranslateService);

  templates: InvitationTemplates | null = null;
  templatesError: string | null = null;

  subject = '';
  message = '';
  language: InvitationLanguage = 'Ar';
  channel: DemoChannel = 'Email';
  /** Set on resend: the preview uses this account's real values. */
  demoAccountId: string | null = null;
  activePreset: string | null = null;
  /** Ids to attach to a test copy (Email only). Set by the dialog. */
  attachmentIds: () => string[] = () => [];
  /**
   * Create page only (no account yet): what the admin typed. The preview request gets
   * these values in place of the matching variables, so the preview shows them before
   * anything is sent. The real create/resend still sends the text with its variables.
   */
  typedValues: (() => InvitationTypedValues) | null = null;
  /** The last preview used at least one typed value. */
  usesTypedValues = false;

  preview: InvitationPreview | null = null;
  /** True from the first keystroke until the preview answers — submit stays off meanwhile. */
  previewLoading = false;
  previewError: string | null = null;
  /** Server-side field errors (VALIDATION_ERROR) not covered by the preview issues. */
  fieldErrors: Partial<Record<'subject' | 'message' | 'language', string | null>> = {};

  testSending = false;
  testResult: string | null = null;
  testError: string | null = null;

  private initial = { subject: '', message: '', language: 'Ar' as InvitationLanguage };
  private readonly previewTrigger = new Subject<void>();
  /** Body of the last preview request, to skip asking again for the same text. */
  private lastPreviewKey: string | null = null;
  private readonly subs = new Subscription();
  private issueCache = new Map<InvitationField, { preview: InvitationPreview | null; issues: InvitationIssue[] }>();

  constructor() {
    this.subs.add(
      this.previewTrigger.pipe(
        tap(() => (this.previewLoading = true)),
        debounceTime(PREVIEW_DEBOUNCE_MS),
        switchMap(() => {
          const { body, subjectEdits, messageEdits } = this.filledPreviewBody();
          // Same text as the last answered preview (e.g. a letter typed then deleted) → no request.
          const key = JSON.stringify(body);
          if (key === this.lastPreviewKey && this.preview) {
            return of({ preview: this.preview, error: null as DemoApiError | null });
          }
          return this.service.previewInvitation(body).pipe(
            // Issue ranges point into the filled text — move them back onto what the admin typed.
            map(preview => {
              // Remembered only once answered: a cancelled or failed request never counts.
              this.lastPreviewKey = key;
              return { preview: this.remapIssues(preview, subjectEdits, messageEdits), error: null as DemoApiError | null };
            }),
            catchError(err => of({ preview: null, error: readDemoError(err) })),
          );
        }),
      ).subscribe(({ preview, error }) => {
        this.previewLoading = false;
        if (preview) {
          this.preview = preview;
          this.previewError = null;
        } else if (error) {
          this.previewError = demoErrorMessage(error, this.translate);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  /** Called once by the dialog when it opens (and after the saved values are loaded on resend). */
  init(opts: { channel: DemoChannel; demoAccountId?: string | null; subject?: string | null; message?: string | null; language?: InvitationLanguage | null }): void {
    this.channel = opts.channel;
    this.demoAccountId = opts.demoAccountId ?? null;
    this.subject = opts.subject ?? '';
    this.message = opts.message ?? '';
    this.language = opts.language ?? 'Ar';
    this.initial = { subject: this.subject, message: this.message, language: this.language };
    this.loadTemplates();
    this.refresh();
  }

  loadTemplates(): void {
    this.templatesError = null;
    this.subs.add(this.service.getInvitationTemplates().subscribe({
      next: t => {
        this.templates = t;
        // Saved text (resend) may use numbers like {{1}}: show it with names, without counting
        // that as a change — {{1}} and {{name}} mean the same to the server.
        const untouched = !this.subjectChanged && !this.messageChanged;
        this.subject = this.readableTokens(this.subject);
        this.message = this.readableTokens(this.message);
        if (untouched) this.initial = { ...this.initial, subject: this.subject, message: this.message };
      },
      error: err => (this.templatesError = demoErrorMessage(readDemoError(err), this.translate)),
    }));
  }

  // ── Derived values ────────────────────────────────────────

  get isEmail(): boolean { return this.channel === 'Email'; }
  get uiEnglish(): boolean { return this.translate.currentLang === 'en'; }

  get subjectMax(): number { return this.templates?.limits.subjectMaxLength ?? 200; }
  get messageMax(): number { return this.templates?.limits.messageMaxLength ?? 2000; }

  get subjectPlaceholder(): string {
    if (!this.templates) return '';
    return this.language === 'En' ? this.templates.defaultSubjectEn : this.templates.defaultSubjectAr;
  }

  get variables(): InvitationVariable[] { return this.templates?.variables ?? []; }
  get presets(): InvitationPreset[] { return this.templates?.presets ?? []; }
  get languages(): InvitationLanguage[] { return this.templates?.languages?.length ? this.templates.languages : ['Ar', 'En']; }

  variableLabel(v: InvitationVariable): string { return this.uiEnglish ? v.labelEn : v.labelAr; }
  variableExample(v: InvitationVariable): string { return this.language === 'En' ? v.exampleEn : v.exampleAr; }
  presetName(p: InvitationPreset): string { return this.uiEnglish ? p.nameEn : p.nameAr; }
  presetDescription(p: InvitationPreset): string { return this.uiEnglish ? p.descriptionEn : p.descriptionAr; }

  /** Create / resend / test copy stay off while a preview is pending or the text is invalid. */
  get blocked(): boolean {
    return this.previewLoading || this.preview?.isValid === false;
  }

  /**
   * A field's issues from the preview — none while a new preview is pending (the ranges
   * belong to the text before the last keystroke). Cached, so the same array comes back
   * until the preview changes.
   */
  issues(field: InvitationField): InvitationIssue[] {
    const preview = this.previewLoading ? null : this.preview;
    const cached = this.issueCache.get(field);
    if (cached && cached.preview === preview) return cached.issues;
    const issues = preview?.issues.filter(i => i.field === field) ?? [];
    this.issueCache.set(field, { preview, issues });
    return issues;
  }

  /** A fix suggestion as the admin sees it: a known token shows its label, like the chips. */
  suggestionLabel(suggestion: string | null | undefined): string {
    if (!suggestion) return '';
    const m = /^\{\{\s*([^{}\s]+)\s*\}\}$/.exec(suggestion.trim());
    const v = m ? this.variableFor(m[1]) : undefined;
    return v ? this.variableLabel(v) : suggestion;
  }

  /** The variable a token names, by number ({{1}}) or key ({{name}}). */
  variableFor(ident: string): InvitationVariable | undefined {
    const id = ident.toLowerCase();
    return this.variables.find(v => String(v.number) === id || v.key.toLowerCase() === id);
  }

  /** What a chip inserts: {{key}} — readable, and the same to the server as {{number}}. */
  tokenOf(v: InvitationVariable): string {
    return `{{${v.key}}}`;
  }

  /** {{1}} → {{name}} for every known variable; anything else is left as typed. */
  readableTokens(text: string): string {
    if (!text || !this.variables.length) return text;
    return text.replace(TOKEN_PATTERN, (match, ident) => {
      const v = this.variableFor(ident);
      return v ? this.tokenOf(v) : match;
    });
  }

  // ── Changes ───────────────────────────────────────────────

  get subjectChanged(): boolean { return this.subject !== this.initial.subject; }
  get messageChanged(): boolean { return this.message !== this.initial.message; }
  get languageChanged(): boolean { return this.language !== this.initial.language; }

  setSubject(value: string): void {
    this.subject = value ?? '';
    this.fieldErrors.subject = null;
    this.refresh();
  }

  setMessage(value: string): void {
    this.message = value ?? '';
    this.fieldErrors.message = null;
    this.refresh();
  }

  setChannel(channel: DemoChannel): void {
    if (channel === this.channel) return;
    this.channel = channel;
    this.refresh();
  }

  setLanguage(language: InvitationLanguage): void {
    if (language === this.language) return;
    const preset = this.presets.find(p => p.id === this.activePreset);
    const old = preset ? (this.language === 'En' ? preset.en : preset.ar) : null;
    this.language = language;
    this.fieldErrors.language = null;
    // Untouched preset text follows the language switch.
    if (preset && old
      && this.readableTokens(old.subject ?? '') === this.subject
      && this.readableTokens(old.message ?? '') === this.message) {
      this.applyPreset(preset);
      return;
    }
    this.refresh();
  }

  /** Fills both fields in the chosen language; the admin edits freely afterwards. Only the text is saved. */
  applyPreset(preset: InvitationPreset): void {
    const t = this.language === 'En' ? preset.en : preset.ar;
    // Presets come with numbers ({{1}}); the editor shows names ({{name}}).
    this.subject = this.readableTokens(t.subject ?? '');
    this.message = this.readableTokens(t.message ?? '');
    this.activePreset = preset.id;
    this.fieldErrors.subject = null;
    this.fieldErrors.message = null;
    this.refresh();
  }

  /** Replaces the issue's range with its suggestion. */
  applySuggestion(issue: InvitationIssue): void {
    if (issue.suggestion == null) return;
    const text = issue.field === 'Subject' ? this.subject : this.message;
    // A suggested {{1}} is shown as {{name}}, like the rest of the editor.
    const next = text.slice(0, issue.start) + this.readableTokens(issue.suggestion) + text.slice(issue.end);
    if (issue.field === 'Subject') this.setSubject(next);
    else this.setMessage(next);
  }

  /** Asks for a fresh preview (debounced). */
  refresh(): void {
    this.testResult = null;
    this.previewTrigger.next();
  }

  /** The subject is only sent for Email; a hidden subject must not block WhatsApp/SMS. */
  previewBody(): InvitationPreviewRequest {
    return {
      ...(this.isEmail ? { invitationSubject: this.subject } : {}),
      invitationMessage: this.message,
      invitationLanguage: this.language,
      ...(this.demoAccountId ? { demoAccountId: this.demoAccountId } : {}),
    };
  }

  // ── Typed values in the preview (create page) ─────────────

  /** previewBody() with the typed values put in place of their variables. */
  private filledPreviewBody(): { body: InvitationPreviewRequest; subjectEdits: TokenEdit[]; messageEdits: TokenEdit[] } {
    const body = this.previewBody();
    const values = !this.demoAccountId && this.typedValues ? this.typedValues() : null;
    if (!values) {
      this.usesTypedValues = false;
      return { body, subjectEdits: [], messageEdits: [] };
    }
    const subject = body.invitationSubject != null ? this.fill(body.invitationSubject, values) : null;
    const message = this.fill(body.invitationMessage ?? '', values);
    this.usesTypedValues = !!(subject?.edits.length || message.edits.length);
    return {
      body: {
        ...body,
        ...(subject ? { invitationSubject: subject.text } : {}),
        invitationMessage: message.text,
      },
      subjectEdits: subject?.edits ?? [],
      messageEdits: message.edits,
    };
  }

  /** Swaps every {{n}} / {{key}} that has a typed value; the rest stay for the server's examples. */
  private fill(text: string, values: InvitationTypedValues): FilledText {
    const edits: TokenEdit[] = [];
    let out = '';
    let last = 0;
    for (const m of text.matchAll(TOKEN_PATTERN)) {
      const value = this.typedValueFor(m[1], values);
      if (value == null) continue;
      const oStart = m.index ?? 0;
      const oEnd = oStart + m[0].length;
      out += text.slice(last, oStart);
      const nStart = out.length;
      out += value;
      edits.push({ oStart, oEnd, nStart, nEnd: out.length });
      last = oEnd;
    }
    return { text: out + text.slice(last), edits };
  }

  /**
   * The typed value for a token, matched on the variable's key: the name, the trial days
   * and the expiry date (worked out from the days). Sign-in data (login link, ID, phone,
   * code, PIN) is made at create time, so it keeps the server's example.
   */
  private typedValueFor(ident: string, values: InvitationTypedValues): string | null {
    const v = this.variableFor(ident);
    if (!v || v.isCredential) return null;
    const key = v.key.toLowerCase();

    if (key.includes('name')) return values.name?.trim() || null;
    if (!values.days || values.days < 1) return null;
    if (key.includes('expir') || key.includes('end')) {
      const date = new Date(Date.now() + values.days * 86_400_000);
      return new Intl.DateTimeFormat(this.language === 'En' ? 'en-GB' : 'ar-EG-u-nu-latn', {
        day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh',
      }).format(date);
    }
    if (key.includes('day') || key.includes('duration')) return String(values.days);
    return null;
  }

  private remapIssues(preview: InvitationPreview, subjectEdits: TokenEdit[], messageEdits: TokenEdit[]): InvitationPreview {
    if (!subjectEdits.length && !messageEdits.length) return preview;
    return {
      ...preview,
      issues: preview.issues.map(i => {
        const edits = i.field === 'Subject' ? subjectEdits : messageEdits;
        return edits.length
          ? { ...i, start: toOriginal(i.start, edits, false), end: toOriginal(i.end, edits, true) }
          : i;
      }),
    };
  }

  // ── Server errors from create / resend ────────────────────

  /**
   * Handles invitation errors from create/resend. Returns true when handled.
   * DEMO_SUBJECT_INVALID / DEMO_MESSAGE_INVALID → fresh preview, whose issues mark the text.
   */
  handleError(e: DemoApiError): boolean {
    if (e.code && TEXT_INVALID_CODES.has(e.code)) {
      this.lastPreviewKey = null; // the server disagreed with the last preview — ask again
      this.previewTrigger.next();
      return true;
    }
    return false;
  }

  /** Places InvitationSubject / InvitationMessage / InvitationLanguage errors; returns the rest. */
  takeFieldErrors(errors: DemoFieldError[]): DemoFieldError[] {
    const rest: DemoFieldError[] = [];
    for (const fe of errors) {
      if (fe.field === 'invitationsubject') this.fieldErrors.subject = fe.message;
      else if (fe.field === 'invitationmessage') this.fieldErrors.message = fe.message;
      else if (fe.field === 'invitationlanguage') this.fieldErrors.language = fe.message;
      else rest.push(fe);
    }
    return rest;
  }

  // ── Test copy to the admin's own email ────────────────────

  sendTest(): void {
    if (this.testSending || this.blocked) return;
    this.testSending = true;
    this.testResult = null;
    this.testError = null;
    const ids = this.isEmail ? this.attachmentIds() : [];

    this.subs.add(this.service.sendTestInvitation({
      // The test copy shows the typed values too, like the preview.
      ...this.filledPreviewBody().body,
      ...(ids.length ? { attachmentIds: ids } : {}),
    }).subscribe({
      next: res => {
        this.testSending = false;
        if (res.sent) this.testResult = this.translate.instant('d3.demoAccounts.invitation.testSent', { recipient: res.recipient });
        else this.testError = this.translate.instant('d3.demoAccounts.errors.DEMO_TEST_SEND_FAILED');
      },
      error: err => {
        this.testSending = false;
        const e = readDemoError(err);
        if (e.status === 429) {
          this.testError = this.translate.instant('d3.demoAccounts.invitation.testLimit');
          return;
        }
        if (this.handleError(e)) return;
        if (e.code === 'VALIDATION_ERROR' && e.fieldErrors.length) {
          // TestEmail = the admin's account has no valid email.
          const rest = this.takeFieldErrors(e.fieldErrors);
          this.testError = rest.map(f => f.message).join(' - ') || null;
          return;
        }
        this.testError = demoErrorMessage(e, this.translate);
      },
    }));
  }
}
