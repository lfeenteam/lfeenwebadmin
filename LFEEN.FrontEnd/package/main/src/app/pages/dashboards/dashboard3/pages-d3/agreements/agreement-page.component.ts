import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { Subscription, firstValueFrom } from 'rxjs';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { HasUnsavedChanges } from './guards/agreement-guards';
import {
  AgreementVersion,
  ClauseFormRow,
  SaveDraftRequest,
  newClauseKey,
} from './interfaces/agreement.model';
import { AgreementActionOutcome, AgreementActionsService } from './services/agreement-actions.service';
import { AgreementLabelsService } from './services/agreement-labels.service';
import { AgreementsService } from './services/agreements.service';
import { AgreementApiError, fieldKey, parseAgreementError } from './utils/agreement-errors.util';

type TextField = 'titleAr' | 'titleEn' | 'descriptionAr' | 'descriptionEn';
type ClauseField = 'titleAr' | 'titleEn' | 'contentAr' | 'contentEn';

const TEXT_FIELDS: TextField[] = ['titleAr', 'titleEn', 'descriptionAr', 'descriptionEn'];
const CLAUSE_FIELDS: ClauseField[] = ['titleAr', 'titleEn', 'contentAr', 'contentEn'];
/** Open every clause of a short agreement; for a long one only the first. */
const OPEN_ALL_UP_TO = 5;

/**
 * /d3/agreements/:id. A Draft opens in the editor (with Agreements.Edit); every other
 * case — Published, Ended, or a draft without Edit — is read-only.
 */
@Component({
  selector: 'app-agreement-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    MatMenuModule,
    TranslateModule,
    TablerIconsModule,
    DashboardEmptyComponent,
    DashboardLoadingComponent,
  ],
  templateUrl: './agreement-page.component.html',
  styleUrl: './agreements.component.scss',
})
export class AgreementPageComponent implements OnInit, HasUnsavedChanges {
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private host = inject(ElementRef<HTMLElement>);
  private service = inject(AgreementsService);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  readonly actions = inject(AgreementActionsService);
  readonly labels = inject(AgreementLabelsService);

  readonly canEdit = this.actions.canEdit;
  readonly canPublish = this.actions.canPublish;

  readonly version = signal<AgreementVersion | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<AgreementApiError | null>(null);
  readonly saving = signal(false);
  /** Publish / expiry / end / copy / delete in flight. */
  readonly busy = signal(false);
  readonly dirty = signal(false);
  /** Field errors keyed by normalized name ("titlear", "clauses[2].contentar"). */
  readonly fieldErrors = signal<Record<string, string>>({});

  // Editor model (plain fields bound with ngModel).
  form: Record<TextField, string> = { titleAr: '', titleEn: '', descriptionAr: '', descriptionEn: '' };
  clauses: ClauseFormRow[] = [];
  /** Viewer accordion state, by clause index. */
  viewerOpen: boolean[] = [];

  readonly isDraft = computed(() => this.version()?.status === 'Draft');
  readonly editable = computed(() => this.isDraft() && this.canEdit());

  readonly errorCount = computed(() => Object.keys(this.fieldErrors()).length);
  readonly errorBanner = computed(() => {
    const errors = this.fieldErrors();
    const count = Object.keys(errors).length;
    if (!count) return '';
    const n = this.labels.num(count);
    const firstClause = Object.keys(errors)
      .map((k) => /^clauses\[(\d+)\]/.exec(k))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => +m[1])
      .sort((a, b) => a - b)[0];
    return firstClause === undefined
      ? this.translate.instant('d3.agreements.validation.bannerFields', { n })
      : this.translate.instant('d3.agreements.validation.bannerClause', { n, clause: this.labels.num(firstClause + 1) });
  });

  private id = 0;
  private loadSub?: Subscription;

  get dir(): 'rtl' | 'ltr' {
    return this.labels.dir;
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.id = Number(params.get('id'));
      this.version.set(null);
      this.load();
    });
  }

  hasUnsavedChanges(): boolean {
    return this.editable() && this.dirty();
  }

  confirmDiscard(): Promise<boolean> {
    return this.actions.confirmDiscard();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  // ── loading ───────────────────────────────────────────────────

  load(): void {
    this.loadSub?.unsubscribe();
    if (!Number.isFinite(this.id) || this.id <= 0) {
      this.loadError.set({ kind: 'notFound', status: 404, errorCode: null, message: null, fields: {} });
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadError.set(null);
    this.loadSub = this.service
      .get(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (v) => {
          this.setFromServer(v);
          this.loading.set(false);
        },
        error: (err) => {
          const e = parseAgreementError(err);
          this.loading.set(false);
          if (e.kind === 'notFound') {
            this.toastr.error(e.message || this.translate.instant('d3.agreements.errors.notFound'));
            this.actions.goToList(this.version()?.type);
            return;
          }
          this.loadError.set(e);
        },
      });
  }

  /** Fresh copy from the server, replacing the editor contents (new local keys). */
  private setFromServer(v: AgreementVersion): void {
    this.version.set(v);
    this.form = {
      titleAr: v.titleAr ?? '',
      titleEn: v.titleEn ?? '',
      descriptionAr: v.descriptionAr ?? '',
      descriptionEn: v.descriptionEn ?? '',
    };
    const list = [...(v.clauses ?? [])].sort((a, b) => a.order - b.order);
    const openAll = list.length <= OPEN_ALL_UP_TO;
    this.clauses = list.map((c, i) => ({
      key: newClauseKey(),
      open: openAll || i === 0,
      titleAr: c.titleAr ?? '',
      titleEn: c.titleEn ?? '',
      contentAr: c.contentAr ?? '',
      contentEn: c.contentEn ?? '',
    }));
    this.viewerOpen = list.map(() => true);
    this.fieldErrors.set({});
    this.dirty.set(false);
  }

  /**
   * After a save: take the server's values but keep each row's local key by position
   * (row n on screen = clause n in the response), so inputs aren't re-created mid-typing.
   */
  private applySaved(v: AgreementVersion): void {
    this.version.set(v);
    this.form = {
      titleAr: v.titleAr ?? '',
      titleEn: v.titleEn ?? '',
      descriptionAr: v.descriptionAr ?? '',
      descriptionEn: v.descriptionEn ?? '',
    };
    const list = [...(v.clauses ?? [])].sort((a, b) => a.order - b.order);
    this.clauses = list.map((c, i) => ({
      key: this.clauses[i]?.key ?? newClauseKey(),
      open: this.clauses[i]?.open ?? true,
      titleAr: c.titleAr ?? '',
      titleEn: c.titleEn ?? '',
      contentAr: c.contentAr ?? '',
      contentEn: c.contentEn ?? '',
    }));
    this.viewerOpen = list.map(() => true);
  }

  // ── editing ───────────────────────────────────────────────────

  markDirty(field?: string): void {
    this.dirty.set(true);
    if (field && this.fieldErrors()[field]) {
      const { [field]: _, ...rest } = this.fieldErrors();
      this.fieldErrors.set(rest);
    }
  }

  err(field: TextField): string {
    return this.fieldErrors()[fieldKey(field)] ?? '';
  }

  clauseErr(index: number, field: ClauseField): string {
    return this.fieldErrors()[fieldKey(field, index)] ?? '';
  }

  clauseHasError(index: number): boolean {
    const prefix = `clauses[${index}].`;
    return Object.keys(this.fieldErrors()).some((k) => k.startsWith(prefix));
  }

  fk(field: string, index?: number): string {
    return fieldKey(field, index);
  }

  addClause(): void {
    const row: ClauseFormRow = { key: newClauseKey(), open: true, titleAr: '', titleEn: '', contentAr: '', contentEn: '' };
    this.clauses = [...this.clauses, row];
    this.markDirty();
    this.dropClauseErrors();
    setTimeout(() => this.focus(`#agc-${row.key}-titleAr`));
  }

  removeClause(index: number): void {
    this.clauses = this.clauses.filter((_, i) => i !== index);
    this.markDirty();
    this.dropClauseErrors();
  }

  moveClause(index: number, delta: -1 | 1): void {
    const to = index + delta;
    if (to < 0 || to >= this.clauses.length) return;
    const next = [...this.clauses];
    moveItemInArray(next, index, to);
    this.clauses = next;
    this.markDirty();
    this.dropClauseErrors();
  }

  dropClause(event: CdkDragDrop<ClauseFormRow[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const next = [...this.clauses];
    moveItemInArray(next, event.previousIndex, event.currentIndex);
    this.clauses = next;
    this.markDirty();
    this.dropClauseErrors();
  }

  toggleClause(row: ClauseFormRow): void {
    row.open = !row.open;
  }

  /** Clause errors are by index, so they no longer point at the right row after a reorder. */
  private dropClauseErrors(): void {
    const kept = Object.entries(this.fieldErrors()).filter(([k]) => !k.startsWith('clauses['));
    if (kept.length !== this.errorCount()) this.fieldErrors.set(Object.fromEntries(kept));
  }

  private buildBody(): SaveDraftRequest {
    const text = (s: string) => s ?? '';
    return {
      titleAr: text(this.form.titleAr),
      titleEn: text(this.form.titleEn),
      descriptionAr: this.form.descriptionAr?.trim() ? this.form.descriptionAr : null,
      descriptionEn: this.form.descriptionEn?.trim() ? this.form.descriptionEn : null,
      // The whole draft every time, in screen order, without the local key / id / order.
      clauses: this.clauses.map(({ titleAr, titleEn, contentAr, contentEn }) => ({
        titleAr: text(titleAr),
        titleEn: text(titleEn),
        contentAr: text(contentAr),
        contentEn: text(contentEn),
      })),
    };
  }

  /** Everything marked * in the design must be filled before publishing. */
  private validateForPublish(): Record<string, string> {
    const errors: Record<string, string> = {};
    const required = (labelKey: string) =>
      this.translate.instant('d3.agreements.validation.required', { field: this.translate.instant(labelKey) });
    for (const f of TEXT_FIELDS) {
      if (!this.form[f]?.trim()) errors[fieldKey(f)] = required(`d3.agreements.form.${f}`);
    }
    this.clauses.forEach((c, i) => {
      for (const f of CLAUSE_FIELDS) {
        if (!c[f]?.trim()) errors[fieldKey(f, i)] = required(`d3.agreements.form.clause_${f}`);
      }
    });
    return errors;
  }

  // ── save ──────────────────────────────────────────────────────

  /** PUT the whole draft. Resolves true when the server has what is on screen. */
  async save(silent = false): Promise<boolean> {
    const v = this.version();
    if (!v || !this.editable() || this.saving()) return false;
    const body = this.buildBody();
    const sent = JSON.stringify(body);
    this.saving.set(true);
    try {
      const saved = await firstValueFrom(this.service.saveDraft(v.id, body));
      // If the admin kept typing while the request was out, keep the screen and stay dirty.
      if (JSON.stringify(this.buildBody()) === sent) {
        this.applySaved(saved);
        this.dirty.set(false);
      } else {
        this.version.set(saved);
      }
      this.fieldErrors.set({});
      if (!silent) this.toastr.success(this.translate.instant('d3.agreements.toast.saved'));
      return true;
    } catch (err) {
      this.onWriteError(parseAgreementError(err));
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private onWriteError(e: AgreementApiError): void {
    if (e.kind === 'validation' && Object.keys(e.fields).length) {
      this.showFieldErrors(e.fields);
      // A field we don't have on screen: its message still has to be seen.
      const known = Object.keys(e.fields).some((k) => this.isScreenField(k));
      if (!known) this.actions.toastError(e);
      return;
    }
    this.actions.toastError(e);
    if (e.kind === 'notFound') {
      this.dirty.set(false);
      this.actions.goToList(this.version()?.type);
    } else if (e.kind === 'other' || e.kind === 'validation') {
      // e.g. it is no longer a draft: pick up its real state, keeping the admin's text if it's still a draft.
      this.refreshKeepingForm();
    }
  }

  private isScreenField(key: string): boolean {
    return TEXT_FIELDS.some((f) => fieldKey(f) === key) || /^clauses\[\d+\]\.(titlear|titleen|contentar|contenten)$/.test(key);
  }

  private showFieldErrors(fields: Record<string, string>): void {
    this.fieldErrors.set(fields);
    // Open every clause with an error, then bring the first bad field into view.
    this.clauses.forEach((c, i) => {
      if (this.clauseHasError(i)) c.open = true;
    });
    setTimeout(() => this.focus('.agv-input.is-invalid'));
  }

  private focus(selector: string): void {
    const el = this.host.nativeElement.querySelector(selector) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  }

  private refreshKeepingForm(): void {
    this.service.get(this.id).subscribe({
      next: (v) => {
        if (v.status === 'Draft' && this.dirty()) this.version.set(v);
        else this.setFromServer(v);
      },
      error: () => {},
    });
  }

  // ── actions ───────────────────────────────────────────────────

  async preview(lang: 'ar' | 'en'): Promise<void> {
    const v = this.version();
    if (!v) return;
    if (!this.hasUnsavedChanges()) {
      this.actions.preview(v.id, lang);
      return;
    }
    // The preview shows what is stored, so save first. The tab opens now, inside the click.
    const win = this.actions.openPreviewTab();
    if (await this.save(true)) {
      this.actions.preview(v.id, lang, win);
    } else {
      win?.close();
    }
  }

  async publish(): Promise<void> {
    const v = this.version();
    if (!v || v.status !== 'Draft' || !this.canPublish() || this.busy() || this.saving()) return;

    const errors = this.validateForPublish();
    if (!this.clauses.length) {
      this.toastr.error(this.translate.instant('d3.agreements.validation.noClauses'));
      return;
    }
    if (Object.keys(errors).length) {
      this.showFieldErrors(errors);
      return;
    }
    if (this.hasUnsavedChanges() && !(await this.save(true))) return;

    await this.runAction(() => this.actions.openPublish(this.version()!));
  }

  editExpiry(): void {
    const v = this.version();
    if (v) this.runAction(() => this.actions.openExpiry(v));
  }

  end(): void {
    const v = this.version();
    if (v) this.runAction(() => this.actions.confirmEnd(v));
  }

  async copyAsDraft(): Promise<void> {
    const v = this.version();
    if (!v || this.busy()) return;
    // Copies what is stored: save first so the copy matches the screen.
    if (this.hasUnsavedChanges() && !(await this.save(true))) return;
    this.busy.set(true);
    try {
      await this.actions.copyAsDraft(v);
    } finally {
      this.busy.set(false);
    }
  }

  async deleteDraft(): Promise<void> {
    const v = this.version();
    if (!v || this.busy()) return;
    this.busy.set(true);
    try {
      const outcome = await this.actions.confirmDelete(v);
      if (outcome.kind === 'done' || outcome.kind === 'notFound') {
        this.dirty.set(false);
        this.actions.goToList(v.type);
      }
    } finally {
      this.busy.set(false);
    }
  }

  back(): void {
    this.actions.goToList(this.version()?.type);
  }

  private async runAction(action: () => Promise<AgreementActionOutcome>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const outcome = await action();
      if (outcome.kind === 'done' && outcome.version) this.setFromServer(outcome.version);
      else if (outcome.kind === 'notFound') this.actions.goToList(this.version()?.type);
      else if (outcome.kind === 'unknown' || outcome.kind === 'failed') this.load();
    } finally {
      this.busy.set(false);
    }
  }

  // ── view helpers ──────────────────────────────────────────────

  pageTitle(v: AgreementVersion): string {
    return this.editable()
      ? this.translate.instant('d3.agreements.editDraftTitle', { type: this.labels.typeLabel(v.type) })
      : `${this.labels.typeLabel(v.type)} · ${this.labels.versionLabel(v)}`;
  }

  publishedText(v: AgreementVersion): string {
    if (!v.publishedAtUtc) return '—';
    return [v.publishedBy, this.labels.date(v.publishedAtUtc)].filter(Boolean).join(' · ');
  }

  endedText(v: AgreementVersion): string {
    if (!v.endedAtUtc) return '—';
    return [this.labels.date(v.endedAtUtc), v.endedBy].filter(Boolean).join(' · ');
  }

  viewerClauses(v: AgreementVersion) {
    return [...(v.clauses ?? [])].sort((a, b) => a.order - b.order);
  }

  clauseHeading(c: { titleAr: string; titleEn: string }): string {
    const primary = this.labels.lang === 'en' ? c.titleEn : c.titleAr;
    const fallback = this.labels.lang === 'en' ? c.titleAr : c.titleEn;
    return primary?.trim() || fallback?.trim() || this.translate.instant('d3.agreements.form.untitledClause');
  }
}
