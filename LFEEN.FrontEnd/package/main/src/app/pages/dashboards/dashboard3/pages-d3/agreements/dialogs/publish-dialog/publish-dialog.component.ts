import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { AgreementDateFieldComponent } from '../../components/agreement-date-field/agreement-date-field.component';
import { AgreementVersion, PublishRequest } from '../../interfaces/agreement.model';
import { AgreementLabelsService } from '../../services/agreement-labels.service';
import { AgreementsService } from '../../services/agreements.service';
import { RiyadhDay, compareDays, riyadhEndOfDayUtc, tomorrowInRiyadh } from '../../utils/agreement-date.util';
import { fieldKey, parseAgreementError } from '../../utils/agreement-errors.util';
import { AgreementDialogResult, dialogErrorText } from '../dialog-result';

export interface PublishDialogData {
  draft: AgreementVersion;
  /** Sum of signedCount over the other Published versions of the same type. */
  previousSignedCount: number;
}

/** «نشر الاتفاقية»: optional expiry date (from tomorrow) and «إنهاء النسخ السابقة» (off by default). */
@Component({
  selector: 'app-publish-dialog',
  standalone: true,
  imports: [FormsModule, TranslateModule, TablerIconsModule, AgreementDateFieldComponent],
  templateUrl: './publish-dialog.component.html',
  styleUrl: '../agreement-dialog.scss',
})
export class PublishDialogComponent {
  private service = inject(AgreementsService);
  private translate = inject(TranslateService);
  readonly labels = inject(AgreementLabelsService);
  readonly ref = inject(MatDialogRef<PublishDialogComponent, AgreementDialogResult>);
  readonly data = inject<PublishDialogData>(MAT_DIALOG_DATA);
  readonly dir = this.labels.dir;

  expiry: RiyadhDay | null = null;
  endPreviousVersions = false;
  readonly saving = signal(false);
  readonly error = signal('');
  readonly expiryError = signal('');

  get subtitle(): string {
    return [
      this.translate.instant('d3.agreements.status.Draft'),
      this.labels.title(this.data.draft),
      this.translate.instant('d3.agreements.clausesN', { n: this.labels.num(this.data.draft.clauseCount) }),
    ].join(' · ');
  }

  onExpiry(day: RiyadhDay | null): void {
    this.expiry = day;
    this.expiryError.set('');
  }

  submit(): void {
    if (this.saving()) return;
    if (this.expiry && compareDays(this.expiry, tomorrowInRiyadh()) < 0) {
      this.expiryError.set(this.translate.instant('d3.agreements.date.mustBeFuture'));
      return;
    }
    const body: PublishRequest = { endPreviousVersions: this.endPreviousVersions };
    if (this.expiry) body.expiresAtUtc = riyadhEndOfDayUtc(this.expiry);

    this.saving.set(true);
    this.error.set('');
    this.service.publish(this.data.draft.id, body).subscribe({
      next: (version) => this.ref.close({ kind: 'done', version }),
      error: (err) => {
        this.saving.set(false);
        const e = parseAgreementError(err);
        // Never resend a publish on its own: the caller refreshes and the admin decides.
        if (e.kind === 'network') return this.ref.close({ kind: 'unknown' });
        if (e.kind === 'notFound') return this.ref.close({ kind: 'notFound', message: e.message });
        const expiryMsg = e.fields[fieldKey('expiresAtUtc')];
        if (expiryMsg) this.expiryError.set(expiryMsg);
        else this.error.set(dialogErrorText(e, this.translate));
      },
    });
  }
}
