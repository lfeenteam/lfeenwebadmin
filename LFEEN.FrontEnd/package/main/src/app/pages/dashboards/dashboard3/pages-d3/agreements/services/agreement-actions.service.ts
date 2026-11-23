import { Injectable, computed, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { LoginService } from '../../../services/login/login.service';
import {
  AGREEMENT_PERMISSIONS,
  AgreementType,
  AgreementVersion,
  hasAgreementPermission,
} from '../interfaces/agreement.model';
import {
  AgreementConfirmDialogComponent,
  AgreementConfirmDialogData,
} from '../dialogs/agreement-confirm-dialog/agreement-confirm-dialog.component';
import { AgreementDialogResult } from '../dialogs/dialog-result';
import { ExpiryDialogComponent, ExpiryDialogData } from '../dialogs/expiry-dialog/expiry-dialog.component';
import { NewDraftDialogComponent, NewDraftDialogData } from '../dialogs/new-draft-dialog/new-draft-dialog.component';
import { PublishDialogComponent, PublishDialogData } from '../dialogs/publish-dialog/publish-dialog.component';
import { AgreementApiError, parseAgreementError, parseBlobError } from '../utils/agreement-errors.util';
import { AgreementLabelsService } from './agreement-labels.service';
import { AgreementsService } from './agreements.service';

/**
 * done      → the write went through (version = the server's copy, when it returned one)
 * cancelled → the admin closed the dialog
 * unknown   → the network dropped mid-request: refresh and let the admin decide
 * notFound  → 404: the caller goes back to / refreshes the list
 * failed    → any other error (already toasted)
 */
export type AgreementActionOutcome =
  | { kind: 'done'; version?: AgreementVersion }
  | { kind: 'cancelled' | 'unknown' | 'notFound' | 'failed' };

const DIALOG_CONFIG = {
  maxWidth: '95vw',
  panelClass: 'agreement-dialog-panel',
  autoFocus: 'dialog' as const,
};

/** Actions shared by the list and the version page; every one shows its own toasts. */
@Injectable({ providedIn: 'root' })
export class AgreementActionsService {
  private service = inject(AgreementsService);
  private labels = inject(AgreementLabelsService);
  private login = inject(LoginService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);

  readonly canEdit = computed(() => hasAgreementPermission(this.login, AGREEMENT_PERMISSIONS.edit));
  readonly canPublish = computed(() => hasAgreementPermission(this.login, AGREEMENT_PERMISSIONS.publish));

  // ── navigation ────────────────────────────────────────────────

  private get langSegment(): string {
    return this.router.url.split('/')[1] || 'ar';
  }

  listLink(type?: AgreementType): { commands: any[]; queryParams?: Record<string, string> } {
    return {
      commands: ['/', this.langSegment, 'd3', 'agreements'],
      queryParams: type && type !== 'Host' ? { type } : undefined,
    };
  }

  goToList(type?: AgreementType): void {
    const link = this.listLink(type);
    this.router.navigate(link.commands, { queryParams: link.queryParams });
  }

  versionCommands(id: number): any[] {
    return ['/', this.langSegment, 'd3', 'agreements', id];
  }

  openVersion(id: number): void {
    this.router.navigate(this.versionCommands(id));
  }

  // ── errors ────────────────────────────────────────────────────

  /** Toast for any error that isn't shown under a field. */
  toastError(error: AgreementApiError, fallbackKey = 'd3.agreements.errors.action'): void {
    if (error.kind === 'network') {
      this.toastr.error(this.translate.instant('d3.agreements.errors.network'));
    } else if (error.kind === 'forbidden') {
      this.toastr.error(this.translate.instant('d3.agreements.errors.forbidden'));
    } else {
      this.toastr.error(error.message || this.translate.instant(fallbackKey));
    }
  }

  private outcomeOf(error: AgreementApiError): AgreementActionOutcome {
    this.toastError(error);
    return { kind: error.kind === 'notFound' ? 'notFound' : 'failed' };
  }

  /** The network dropped during publish/end/expiry: it may have gone through. Never resent on its own. */
  private warnUnknown(): AgreementActionOutcome {
    this.toastr.warning(this.translate.instant('d3.agreements.errors.unknownResult'), '', { timeOut: 9000 });
    return { kind: 'unknown' };
  }

  private fromDialog(result: AgreementDialogResult | undefined, successText: (v: AgreementVersion) => string): AgreementActionOutcome {
    if (!result) return { kind: 'cancelled' };
    if (result.kind === 'unknown') return this.warnUnknown();
    if (result.kind === 'notFound') {
      this.toastr.error(result.message || this.translate.instant('d3.agreements.errors.notFound'));
      return { kind: 'notFound' };
    }
    this.toastr.success(successText(result.version));
    return { kind: 'done', version: result.version };
  }

  // ── PDF preview ───────────────────────────────────────────────

  /**
   * Opens the stored version as a PDF in a new tab. The endpoint needs the token, so the
   * file is fetched as a blob. The tab is opened right away (inside the click) so popup
   * blockers allow it, then pointed at the blob once it arrives.
   */
  async preview(id: number, lang: 'ar' | 'en', preopened?: Window | null): Promise<void> {
    const win = preopened === undefined ? this.openPreviewTab() : preopened;
    try {
      const blob = await firstValueFrom(this.service.previewPdf(id, lang));
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      if (win) win.location.href = url;
      else if (!window.open(url, '_blank')) this.toastr.warning(this.translate.instant('d3.agreements.preview.blocked'));
      // Long enough for the tab to load the file.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      win?.close();
      this.toastError(await parseBlobError(err), 'd3.agreements.errors.preview');
    }
  }

  /**
   * Opens the (blank) preview tab. Must run inside the click: a caller that saves first
   * opens the tab, awaits the save, then passes the tab to preview() (or closes it).
   */
  openPreviewTab(): Window | null {
    const win = window.open('', '_blank');
    if (win) {
      const text = this.translate.instant('d3.agreements.preview.loading');
      win.document.title = text;
      win.document.body.style.fontFamily = 'Cairo, sans-serif';
      win.document.body.textContent = text;
    }
    return win;
  }

  // ── drafts ────────────────────────────────────────────────────

  async openNewDraft(type: AgreementType, versions: AgreementVersion[]): Promise<AgreementActionOutcome> {
    const ref = this.dialog.open<NewDraftDialogComponent, NewDraftDialogData, AgreementDialogResult>(
      NewDraftDialogComponent,
      { ...DIALOG_CONFIG, width: '600px', data: { type, versions } },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result || result.kind !== 'done') return { kind: 'cancelled' };
    this.toastr.success(this.translate.instant('d3.agreements.toast.draftCreated'));
    this.openVersion(result.version.id);
    return { kind: 'done', version: result.version };
  }

  /** «نسخ كمسودة جديدة»: an exact copy (type + copyFromAgreementId only), then open the editor. */
  async copyAsDraft(source: AgreementVersion): Promise<AgreementActionOutcome> {
    try {
      const version = await firstValueFrom(
        this.service.createDraft({ type: source.type, copyFromAgreementId: source.id }),
      );
      this.toastr.success(this.translate.instant('d3.agreements.toast.draftCreated'));
      this.openVersion(version.id);
      return { kind: 'done', version };
    } catch (err) {
      return this.outcomeOf(parseAgreementError(err));
    }
  }

  async confirmDelete(draft: AgreementVersion): Promise<AgreementActionOutcome> {
    const confirmed = await this.confirm({
      title: this.translate.instant('d3.agreements.delete.title'),
      alertTitle: this.translate.instant('d3.agreements.delete.alertTitle'),
      alertText: this.translate.instant('d3.agreements.delete.alertText'),
      heading: [
        this.labels.title(draft),
        this.translate.instant('d3.agreements.status.Draft'),
        this.labels.clauses(draft.clauseCount),
      ].join(' · '),
      text: this.translate.instant('d3.agreements.delete.text'),
      confirmLabel: this.translate.instant('d3.agreements.delete.confirm'),
    });
    if (!confirmed) return { kind: 'cancelled' };
    try {
      await firstValueFrom(this.service.deleteDraft(draft.id));
      this.toastr.success(this.translate.instant('d3.agreements.toast.draftDeleted'));
      return { kind: 'done' };
    } catch (err) {
      return this.outcomeOf(parseAgreementError(err));
    }
  }

  // ── publish / expiry / end ────────────────────────────────────

  /**
   * Opens the publish dialog. N in its warning = signers of the other Published versions
   * of this type, read fresh from the list.
   */
  async openPublish(draft: AgreementVersion): Promise<AgreementActionOutcome> {
    let previousSignedCount = 0;
    try {
      const list = await firstValueFrom(this.service.list(draft.type));
      previousSignedCount = list
        .filter((v) => v.status === 'Published' && v.id !== draft.id)
        .reduce((sum, v) => sum + (v.signedCount || 0), 0);
    } catch (err) {
      return this.outcomeOf(parseAgreementError(err));
    }
    const ref = this.dialog.open<PublishDialogComponent, PublishDialogData, AgreementDialogResult>(
      PublishDialogComponent,
      { ...DIALOG_CONFIG, width: '600px', disableClose: true, data: { draft, previousSignedCount } },
    );
    const result = await firstValueFrom(ref.afterClosed());
    return this.fromDialog(result, (v) =>
      this.translate.instant('d3.agreements.toast.published', { n: this.labels.num(v.version) }),
    );
  }

  async openExpiry(version: AgreementVersion): Promise<AgreementActionOutcome> {
    const ref = this.dialog.open<ExpiryDialogComponent, ExpiryDialogData, AgreementDialogResult>(
      ExpiryDialogComponent,
      { ...DIALOG_CONFIG, width: '600px', disableClose: true, data: { version } },
    );
    const result = await firstValueFrom(ref.afterClosed());
    return this.fromDialog(result, () => this.translate.instant('d3.agreements.toast.expiryUpdated'));
  }

  async confirmEnd(version: AgreementVersion): Promise<AgreementActionOutcome> {
    const n = this.labels.num(version.version);
    const confirmed = await this.confirm({
      title: this.translate.instant('d3.agreements.end.title', { n }),
      alertTitle: this.translate.instant('d3.agreements.end.alertTitle'),
      alertText: this.translate.instant('d3.agreements.end.alertText', { n }),
      heading: this.translate.instant('d3.agreements.end.heading', { count: this.labels.num(version.signedCount) }),
      text: this.translate.instant('d3.agreements.end.text'),
      confirmLabel: this.translate.instant('d3.agreements.end.confirm'),
    });
    if (!confirmed) return { kind: 'cancelled' };
    try {
      const updated = await firstValueFrom(this.service.end(version.id));
      this.toastr.success(this.translate.instant('d3.agreements.toast.ended', { n }));
      return { kind: 'done', version: updated };
    } catch (err) {
      const e = parseAgreementError(err);
      if (e.kind === 'network') return this.warnUnknown();
      return this.outcomeOf(e);
    }
  }

  private async confirm(data: AgreementConfirmDialogData): Promise<boolean> {
    const ref = this.dialog.open<AgreementConfirmDialogComponent, AgreementConfirmDialogData, boolean>(
      AgreementConfirmDialogComponent,
      { ...DIALOG_CONFIG, width: '600px', data },
    );
    return !!(await firstValueFrom(ref.afterClosed()));
  }

  /** Generic "discard unsaved changes?" confirm for leaving the editor. */
  confirmDiscard(): Promise<boolean> {
    return this.confirm({
      title: this.translate.instant('d3.agreements.unsaved.title'),
      alertTitle: this.translate.instant('d3.agreements.unsaved.alertTitle'),
      alertText: this.translate.instant('d3.agreements.unsaved.alertText'),
      heading: '',
      text: '',
      confirmLabel: this.translate.instant('d3.agreements.unsaved.confirm'),
    });
  }
}
