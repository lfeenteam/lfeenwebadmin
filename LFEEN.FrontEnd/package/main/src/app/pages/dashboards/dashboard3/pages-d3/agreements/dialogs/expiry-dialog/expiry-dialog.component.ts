import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { AgreementDateFieldComponent } from '../../components/agreement-date-field/agreement-date-field.component';
import { AgreementVersion } from '../../interfaces/agreement.model';
import { AgreementLabelsService } from '../../services/agreement-labels.service';
import { AgreementsService } from '../../services/agreements.service';
import {
  RiyadhDay,
  compareDays,
  riyadhDayOf,
  riyadhEndOfDayUtc,
  tomorrowInRiyadh,
} from '../../utils/agreement-date.util';
import { fieldKey, parseAgreementError } from '../../utils/agreement-errors.util';
import { AgreementDialogResult, dialogErrorText } from '../dialog-result';

export interface ExpiryDialogData {
  version: AgreementVersion;
}

/** «تعديل تاريخ الانتهاء» on a Published version: set, change, or clear (null). */
@Component({
  selector: 'app-expiry-dialog',
  standalone: true,
  imports: [FormsModule, TranslateModule, TablerIconsModule, AgreementDateFieldComponent],
  templateUrl: './expiry-dialog.component.html',
  styleUrl: '../agreement-dialog.scss',
})
export class ExpiryDialogComponent {
  private service = inject(AgreementsService);
  private translate = inject(TranslateService);
  readonly labels = inject(AgreementLabelsService);
  readonly ref = inject(MatDialogRef<ExpiryDialogComponent, AgreementDialogResult>);
  readonly data = inject<ExpiryDialogData>(MAT_DIALOG_DATA);
  readonly dir = this.labels.dir;

  private readonly initial = riyadhDayOf(this.data.version.expiresAtUtc);
  /** A date that already passed can't be kept as the pick: the calendar would refuse it anyway. */
  expiry: RiyadhDay | null =
    this.initial && compareDays(this.initial, tomorrowInRiyadh()) >= 0 ? this.initial : null;
  removeDate = false;
  readonly saving = signal(false);
  readonly error = signal('');
  readonly expiryError = signal('');

  get subtitle(): string {
    return `${this.labels.versionLabel(this.data.version)} · ${this.labels.title(this.data.version)}`;
  }

  onExpiry(day: RiyadhDay | null): void {
    this.expiry = day;
    this.expiryError.set('');
  }

  onRemoveChange(): void {
    this.expiryError.set('');
  }

  submit(): void {
    if (this.saving()) return;
    let value: string | null = null;
    if (!this.removeDate) {
      if (!this.expiry) {
        this.expiryError.set(this.translate.instant('d3.agreements.date.required'));
        return;
      }
      if (compareDays(this.expiry, tomorrowInRiyadh()) < 0) {
        this.expiryError.set(this.translate.instant('d3.agreements.date.mustBeFuture'));
        return;
      }
      value = riyadhEndOfDayUtc(this.expiry);
    }

    this.saving.set(true);
    this.error.set('');
    this.service.setExpiry(this.data.version.id, value).subscribe({
      next: (version) => this.ref.close({ kind: 'done', version }),
      error: (err) => {
        this.saving.set(false);
        const e = parseAgreementError(err);
        if (e.kind === 'network') return this.ref.close({ kind: 'unknown' });
        if (e.kind === 'notFound') return this.ref.close({ kind: 'notFound', message: e.message });
        const expiryMsg = e.fields[fieldKey('expiresAtUtc')];
        if (expiryMsg) this.expiryError.set(expiryMsg);
        else this.error.set(dialogErrorText(e, this.translate));
      },
    });
  }
}
