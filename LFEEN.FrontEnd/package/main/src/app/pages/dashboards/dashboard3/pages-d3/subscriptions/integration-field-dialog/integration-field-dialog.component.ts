import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import { IntegrationFieldType, SubscriptionIntegrationField } from '../interfaces/subscription.model';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';

export interface IntegrationFieldDialogData {
  subscriptionServiceId: number;
  /** Keys already used on this service — a key must be unique per service. */
  existingKeys: string[];
}

const KEY_PATTERN = /^[A-Za-z0-9_]+$/;
const KEY_MAX = 50;

/**
 * Adds one integration field (POST /integration-fields): what the merchant must submit to
 * connect the service. Required vs optional is an explicit choice with no default, so the
 * admin always decides it rather than leaving a toggle as it was.
 */
@Component({
  selector: 'app-integration-field-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule, TablerIconsModule],
  templateUrl: './integration-field-dialog.component.html',
  styleUrls: [
    '../subscription-discount-codes/create-discount-code-dialog/create-discount-code-dialog.component.scss',
    './integration-field-dialog.component.scss',
  ],
})
export class IntegrationFieldDialogComponent {
  private translate = inject(TranslateService);
  private service = inject(SubscriptionsService);

  readonly fieldTypes: IntegrationFieldType[] = ['Text', 'Secret', 'Url'];
  readonly keyMax = KEY_MAX;

  labelAr = '';
  labelEn = '';
  key = '';
  fieldType: IntegrationFieldType = 'Text';
  /** null until the admin picks one — Save stays disabled until then. */
  isRequired: boolean | null = null;

  submitting = false;
  serverError = '';

  constructor(
    public dialogRef: MatDialogRef<IntegrationFieldDialogComponent, SubscriptionIntegrationField>,
    @Inject(MAT_DIALOG_DATA) public data: IntegrationFieldDialogData,
  ) {}

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get keyError(): string | null {
    const key = this.key.trim();
    if (!key) return null;
    if (key.length > KEY_MAX || !KEY_PATTERN.test(key)) return 'd3.integrationField.errors.keyFormat';
    return this.data.existingKeys.includes(key) ? 'd3.integrationField.errors.keyExists' : null;
  }

  get canSubmit(): boolean {
    return !this.submitting && !!this.labelAr.trim() && !!this.labelEn.trim()
      && !!this.key.trim() && !this.keyError && this.isRequired !== null;
  }

  submit(): void {
    if (!this.canSubmit || this.isRequired === null) return;
    this.submitting = true;
    this.serverError = '';
    this.service.createIntegrationField({
      subscriptionServiceId: this.data.subscriptionServiceId,
      key: this.key.trim(),
      labelAr: this.labelAr.trim(),
      labelEn: this.labelEn.trim(),
      fieldType: this.fieldType,
      isRequired: this.isRequired,
    }).subscribe({
      next: created => {
        this.submitting = false;
        this.dialogRef.close(created);
      },
      error: err => {
        this.submitting = false;
        this.serverError = resolveSubscriptionError(err, this.translate);
      },
    });
  }

  close(): void {
    if (this.submitting) return;
    this.dialogRef.close();
  }
}
