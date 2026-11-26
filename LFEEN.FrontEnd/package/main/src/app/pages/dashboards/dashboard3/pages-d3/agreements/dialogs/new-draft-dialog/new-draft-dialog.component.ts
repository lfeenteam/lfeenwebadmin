import { Component, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { AgreementType, AgreementVersion, CreateDraftRequest, sortAgreementVersions } from '../../interfaces/agreement.model';
import { AgreementsService } from '../../services/agreements.service';
import { fieldKey, parseAgreementError } from '../../utils/agreement-errors.util';
import { AgreementLabelsService } from '../../services/agreement-labels.service';
import { AgreementDialogResult, dialogErrorText } from '../dialog-result';
import { AppPluralPipe } from 'src/app/pipes/app-plural.pipe';

export interface NewDraftDialogData {
  type: AgreementType;
  /** Every version of this type, to copy from. */
  versions: AgreementVersion[];
}

/** «مسودة جديدة»: blank, or copied from an existing version of the same type (default: the current one). */
@Component({
  selector: 'app-new-draft-dialog',
  standalone: true,
  imports: [NgClass, FormsModule, MatSelectModule, TranslateModule, TablerIconsModule, AppPluralPipe],
  templateUrl: './new-draft-dialog.component.html',
  styleUrl: '../agreement-dialog.scss',
})
export class NewDraftDialogComponent {
  private service = inject(AgreementsService);
  private translate = inject(TranslateService);
  readonly labels = inject(AgreementLabelsService);
  readonly ref = inject(MatDialogRef<NewDraftDialogComponent, AgreementDialogResult>);
  readonly data = inject<NewDraftDialogData>(MAT_DIALOG_DATA);
  readonly dir = this.translate.currentLang === 'en' ? 'ltr' : 'rtl';

  readonly sources = sortAgreementVersions(this.data.versions.filter((v) => v.type === this.data.type));
  mode: 'blank' | 'copy' = this.sources.length ? 'copy' : 'blank';
  sourceId: number | null =
    (this.sources.find((v) => v.isCurrent) ?? this.sources.find((v) => v.status === 'Published') ?? this.sources[0])?.id ?? null;

  readonly saving = signal(false);
  readonly error = signal('');
  readonly sourceError = signal('');

  selectedSource(): AgreementVersion | null {
    return this.sources.find((v) => v.id === this.sourceId) ?? null;
  }

  selectSource(id: number): void {
    this.sourceId = id;
    this.sourceError.set('');
  }

  /** "11 بندًا · نُشرت 11 نوفمبر 2026", or the last edit for a draft. */
  sourceMeta(v: AgreementVersion): string {
    const clauses = this.labels.clauses(v.clauseCount);
    const when = v.publishedAtUtc
      ? this.translate.instant('d3.agreements.newDraft.publishedOn', { date: this.labels.date(v.publishedAtUtc) })
      : v.updatedAt
        ? this.translate.instant('d3.agreements.newDraft.editedOn', { date: this.labels.date(v.updatedAt) })
        : '';
    return when ? `${clauses} · ${when}` : clauses;
  }

  submit(): void {
    if (this.saving()) return;
    if (this.mode === 'copy' && !this.sourceId) {
      this.sourceError.set(this.translate.instant('d3.agreements.newDraft.sourceRequired'));
      return;
    }
    const body: CreateDraftRequest = { type: this.data.type };
    // A straight copy: only type + copyFromAgreementId, so every other field stays as copied.
    if (this.mode === 'copy' && this.sourceId) body.copyFromAgreementId = this.sourceId;

    this.saving.set(true);
    this.error.set('');
    this.sourceError.set('');
    this.service.createDraft(body).subscribe({
      next: (version) => this.ref.close({ kind: 'done', version }),
      error: (err) => {
        this.saving.set(false);
        const e = parseAgreementError(err);
        if (e.kind === 'network') {
          this.error.set(this.translate.instant('d3.agreements.errors.network'));
          return;
        }
        const sourceMsg = e.fields[fieldKey('copyFromAgreementId')];
        if (sourceMsg) {
          this.sourceError.set(sourceMsg);
          return;
        }
        // This dialog has no other fields: show the server's field messages as they are,
        // since its general message ("بيانات غير صحيحة") alone doesn't say what's wrong.
        const details = Object.values(e.fields);
        this.error.set(details.length ? details.join(' · ') : dialogErrorText(e, this.translate));
      },
    });
  }
}
