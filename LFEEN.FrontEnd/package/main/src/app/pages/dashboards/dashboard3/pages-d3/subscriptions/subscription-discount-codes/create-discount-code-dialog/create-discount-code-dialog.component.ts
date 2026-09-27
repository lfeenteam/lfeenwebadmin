import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { SubscriptionsService } from '../../../../services/subscriptions.service';
import { SingleDateCalendarComponent } from '../../../all-bookings/components/single-date-calendar/single-date-calendar.component';
import {
  CreateSubscriptionDiscountCodeRequest,
  SubscriptionCatalogItem,
  SubscriptionDiscountCode,
  SubscriptionDiscountType,
} from '../../interfaces/subscription.model';
import { resolveSubscriptionError } from '../../interfaces/subscription-error.util';

export interface CreateDiscountCodeDialogData {
  services: SubscriptionCatalogItem[];
}

const CODE_PATTERN = /^[A-Z0-9_-]+$/;
const CODE_MAX = 50;
const GENERATED_LENGTH = 8;
// No 0/O/1/I so generated codes are easy to read aloud and type.
const GENERATED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Component({
  selector: 'app-create-discount-code-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule, TablerIconsModule, SingleDateCalendarComponent],
  templateUrl: './create-discount-code-dialog.component.html',
  styleUrl: './create-discount-code-dialog.component.scss'
})
export class CreateDiscountCodeDialogComponent {
  private translate = inject(TranslateService);
  private service = inject(SubscriptionsService);

  readonly codeMax = CODE_MAX;

  code = '';
  /** 'all' rather than null: mat-select renders a null value as an empty field. Sent as null. */
  serviceSelection: number | 'all' = 'all';
  discountType: SubscriptionDiscountType = 'Percentage';
  discountValue: number | null = null;
  maxDiscountAmount: number | null = null;
  appliesToSubscriptionFee = true;
  appliesToSetupFee = true;
  maxRedemptions: number | null = null;
  validFrom = '';
  validTo = '';

  submitting = false;
  /** Server messages come back as one string — shown above the actions. */
  serverError = '';

  constructor(
    public dialogRef: MatDialogRef<CreateDiscountCodeDialogComponent, SubscriptionDiscountCode>,
    @Inject(MAT_DIALOG_DATA) public data: CreateDiscountCodeDialogData,
  ) {}

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.translate.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get isPercentage(): boolean {
    return this.discountType === 'Percentage';
  }

  get activeServices(): SubscriptionCatalogItem[] {
    return this.data.services.filter(s => s.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  serviceName(s: SubscriptionCatalogItem): string {
    return this.translate.currentLang === 'en' ? s.nameEn : s.nameAr;
  }

  // ── Validation (the server only returns the first error, so check everything here) ──
  get codeError(): string | null {
    const code = this.code.trim();
    if (!code) return null;
    if (code.length > CODE_MAX || !CODE_PATTERN.test(code)) return 'd3.discountCodes.create.errors.codeFormat';
    return null;
  }

  get valueError(): string | null {
    const v = this.discountValue;
    if (v === null) return null;
    if (!(v > 0)) return 'd3.discountCodes.create.errors.valuePositive';
    if (this.isPercentage && v > 100) return 'd3.discountCodes.create.errors.percentMax';
    return null;
  }

  get maxDiscountError(): string | null {
    const v = this.maxDiscountAmount;
    return v !== null && !(v > 0) ? 'd3.discountCodes.create.errors.valuePositive' : null;
  }

  get redemptionsError(): string | null {
    const v = this.maxRedemptions;
    return v !== null && (!Number.isInteger(v) || v < 1) ? 'd3.discountCodes.create.errors.redemptionsMin' : null;
  }

  get appliesToError(): boolean {
    return !this.appliesToSubscriptionFee && !this.appliesToSetupFee;
  }

  /** Today as a local 'YYYY-MM-DD' — the earliest start date a new code may have. */
  get todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // The calendars already block these, but a date picked earlier can end up invalid —
  // an end date before a start date chosen afterwards, or the dialog left open past midnight.
  get datesError(): boolean {
    const today = this.todayIso;
    return (!!this.validFrom && this.validFrom < today)
      || (!!this.validTo && this.validTo < today)
      || (!!this.validFrom && !!this.validTo && this.validTo < this.validFrom);
  }

  get canSubmit(): boolean {
    return !this.submitting
      && !!this.code.trim() && !this.codeError
      && this.discountValue !== null && !this.valueError
      && !this.maxDiscountError && !this.redemptionsError
      && !this.appliesToError && !this.datesError;
  }

  setType(type: SubscriptionDiscountType): void {
    this.discountType = type;
    if (type !== 'Percentage') this.maxDiscountAmount = null;
  }

  /** 'YYYY-MM-DD' (local calendar day) → localized label, or the "pick a date" placeholder. */
  dateLabel(value: string): string {
    if (!value) return this.translate.instant('d3.discountCodes.create.pickDate');
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-EG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  normalizeCode(): void {
    this.code = this.code.toUpperCase().replace(/\s+/g, '');
  }

  generateCode(): void {
    const bytes = new Uint32Array(GENERATED_LENGTH);
    crypto.getRandomValues(bytes);
    this.code = Array.from(bytes, b => GENERATED_ALPHABET[b % GENERATED_ALPHABET.length]).join('');
  }

  submit(): void {
    if (!this.canSubmit || this.discountValue === null) return;
    this.submitting = true;
    this.serverError = '';

    const body: CreateSubscriptionDiscountCodeRequest = {
      code: this.code.trim(),
      subscriptionServiceId: this.serviceSelection === 'all' ? null : this.serviceSelection,
      discountType: this.discountType,
      discountValue: this.discountValue,
      maxDiscountAmount: this.isPercentage ? this.maxDiscountAmount : null,
      appliesToSubscriptionFee: this.appliesToSubscriptionFee,
      appliesToSetupFee: this.appliesToSetupFee,
      maxRedemptions: this.maxRedemptions,
      // Date inputs are local calendar days: the code is valid from the start of the
      // first day through the end of the last one, in the admin's time zone.
      validFrom: this.validFrom ? new Date(`${this.validFrom}T00:00:00`).toISOString() : null,
      validTo: this.validTo ? new Date(`${this.validTo}T23:59:59`).toISOString() : null,
    };

    this.service.createDiscountCode(body).subscribe({
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
