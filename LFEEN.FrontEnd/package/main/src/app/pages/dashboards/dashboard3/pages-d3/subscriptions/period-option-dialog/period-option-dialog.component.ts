import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import { SubscriptionPeriodOption, SubscriptionTier } from '../interfaces/subscription.model';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';

export interface PeriodOptionDialogData {
  subscriptionServiceId: number;
  /** Active tiers; the tier is only chosen on create — an edit keeps the option's own tier. */
  tiers: SubscriptionTier[];
  /** null = add a new option. */
  option: SubscriptionPeriodOption | null;
  /** Used as the default order of a new option. */
  nextDisplayOrder: number;
}

/** Quick picks for the duration; the API only stores the day count. */
interface DurationPreset {
  days: number;
  nameAr: string;
  nameEn: string;
}

const PRESETS: DurationPreset[] = [
  { days: 30, nameAr: 'شهر واحد', nameEn: '1 Month' },
  { days: 90, nameAr: '3 شهور', nameEn: '3 Months' },
  { days: 180, nameAr: '6 شهور', nameEn: '6 Months' },
  { days: 365, nameAr: '12 شهر', nameEn: '12 Months' },
];

/**
 * One Package-style period option: a duration in days, its display names and a flat price.
 * Create = POST /period-options. Edit = PUT /period-options/{id}, which closes that row and
 * opens a new one, so merchants already on it keep the price they bought.
 */
@Component({
  selector: 'app-period-option-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule, TablerIconsModule],
  templateUrl: './period-option-dialog.component.html',
  styleUrls: [
    '../subscription-discount-codes/create-discount-code-dialog/create-discount-code-dialog.component.scss',
    './period-option-dialog.component.scss',
  ],
})
export class PeriodOptionDialogComponent {
  private translate = inject(TranslateService);
  private service = inject(SubscriptionsService);

  readonly presets = PRESETS;
  readonly isEdit: boolean;

  /** 'default' rather than null: mat-select renders a null value as an empty field. */
  tierSelection: number | 'default' = 'default';
  durationInDays: number | null;
  nameAr: string;
  nameEn: string;
  price: number | null;
  displayOrder: number | null;

  submitting = false;
  serverError = '';

  constructor(
    public dialogRef: MatDialogRef<PeriodOptionDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: PeriodOptionDialogData,
  ) {
    const o = data.option;
    this.isEdit = !!o;
    this.durationInDays = o?.durationInDays ?? null;
    this.nameAr = o?.nameAr ?? '';
    this.nameEn = o?.nameEn ?? '';
    this.price = o?.price ?? null;
    this.displayOrder = o?.displayOrder ?? data.nextDisplayOrder;
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.translate.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  tierName(t: SubscriptionTier): string {
    return (this.translate.currentLang === 'en' ? t.nameEn : t.nameAr) || t.key;
  }

  presetLabel(p: DurationPreset): string {
    return this.translate.currentLang === 'en' ? p.nameEn : p.nameAr;
  }

  /**
   * Fills the day count, and each name too while it's still empty or a preset's — checked
   * per name, so a filled-in Arabic name doesn't stop the English one from following.
   */
  applyPreset(p: DurationPreset): void {
    this.durationInDays = p.days;
    if (!this.nameAr.trim() || PRESETS.some(x => x.nameAr === this.nameAr)) this.nameAr = p.nameAr;
    if (!this.nameEn.trim() || PRESETS.some(x => x.nameEn === this.nameEn)) this.nameEn = p.nameEn;
  }

  // ── Validation (mirrors SUBSCRIPTION_PERIOD_OPTION_*) ──
  get durationError(): boolean {
    const d = this.durationInDays;
    return d !== null && !(Number.isInteger(d) && d > 0);
  }

  get priceError(): boolean {
    return this.price !== null && !(this.price > 0);
  }

  get displayOrderError(): boolean {
    const o = this.displayOrder;
    return o !== null && !(Number.isInteger(o) && o >= 0);
  }

  get canSubmit(): boolean {
    return !this.submitting
      && this.durationInDays !== null && !this.durationError
      && this.price !== null && !this.priceError
      && this.displayOrder !== null && !this.displayOrderError
      && !!this.nameAr.trim() && !!this.nameEn.trim();
  }

  submit(): void {
    if (!this.canSubmit || this.durationInDays === null || this.price === null || this.displayOrder === null) return;
    this.submitting = true;
    this.serverError = '';

    const fields = {
      durationInDays: this.durationInDays,
      nameAr: this.nameAr.trim(),
      nameEn: this.nameEn.trim(),
      price: this.price,
      displayOrder: this.displayOrder,
    };
    const option = this.data.option;
    const request$ = option
      ? this.service.updatePeriodOption(option.id, { ...fields, currencyCode: option.currencyCode })
      : this.service.createPeriodOption({
          ...fields,
          subscriptionServiceId: this.data.subscriptionServiceId,
          subscriptionServiceTierId: this.tierSelection === 'default' ? null : this.tierSelection,
          // The guide calls it optional, but the API rejects the request without it.
          currencyCode: 'SAR',
        });

    request$.subscribe({
      next: () => {
        this.submitting = false;
        this.dialogRef.close(true);
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
