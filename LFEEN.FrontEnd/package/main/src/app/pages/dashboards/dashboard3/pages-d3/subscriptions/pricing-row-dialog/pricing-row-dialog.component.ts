import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import {
  SubscriptionPricingItem,
  SubscriptionTier,
  SubscriptionUsageUnitType,
} from '../interfaces/subscription.model';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';

export interface PricingRowDialogData {
  subscriptionServiceId: number;
  /** Active tiers; with none (or one) the rate is saved on the service's default tier. */
  tiers: SubscriptionTier[];
  /** This service's active Transaction rows — picking a tier that has one loads its values. */
  activeRates: SubscriptionPricingItem[];
}

type RateType = Exclude<SubscriptionUsageUnitType, 'None'>;

/**
 * A Transaction-style service's per-operation rate (POST /pricing, period "None", price 0):
 * a flat amount per operation, or a percentage of its value with a required cap. Saving never
 * edits in place — it closes the active rate for the same tier and opens a new one.
 */
@Component({
  selector: 'app-pricing-row-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule, TablerIconsModule],
  templateUrl: './pricing-row-dialog.component.html',
  styleUrls: [
    '../subscription-discount-codes/create-discount-code-dialog/create-discount-code-dialog.component.scss',
    './pricing-row-dialog.component.scss',
  ],
})
export class PricingRowDialogComponent {
  private translate = inject(TranslateService);
  private service = inject(SubscriptionsService);

  readonly rateTypes: RateType[] = ['PerUnit', 'PercentageOfValue'];

  /** 'default' rather than null: mat-select renders a null value as an empty field. */
  tierSelection: number | 'default' = 'default';
  usageUnitType: RateType = 'PerUnit';
  /** PerUnit: SAR per operation. PercentageOfValue: a percent (2.5 = 2.5%). */
  usageUnitPrice: number | null = null;
  usageMaxFeeAmount: number | null = null;

  /** true when the chosen tier already has an active rate, which saving will replace. */
  replacesExisting = false;
  /** Currency of the rate being replaced, kept on the new row. */
  private existingCurrency: string | null = null;
  submitting = false;
  serverError = '';

  constructor(
    public dialogRef: MatDialogRef<PricingRowDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: PricingRowDialogData,
  ) {
    this.loadExisting();
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.translate.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get isPercentage(): boolean {
    return this.usageUnitType === 'PercentageOfValue';
  }

  private get tierId(): number | null {
    return this.tierSelection === 'default' ? null : this.tierSelection;
  }

  tierName(t: SubscriptionTier): string {
    return (this.translate.currentLang === 'en' ? t.nameEn : t.nameAr) || t.key;
  }

  /** Fills the form from the chosen tier's active rate, if it has one. */
  loadExisting(): void {
    const tier = this.tierId;
    const defaultTierId = this.data.tiers.find(t => t.isDefault)?.id ?? null;
    const row = this.data.activeRates.find(p => tier === null
      ? p.subscriptionServiceTierId == null || p.subscriptionServiceTierId === defaultTierId
      : p.subscriptionServiceTierId === tier);

    this.replacesExisting = !!row;
    this.existingCurrency = row?.currencyCode ?? null;
    this.usageUnitType = row?.usageUnitType === 'PercentageOfValue' ? 'PercentageOfValue' : 'PerUnit';
    const unit = typeof row?.usageUnitPrice === 'number' ? row.usageUnitPrice : null;
    this.usageUnitPrice = unit === null ? null : this.isPercentage ? +(unit * 100).toFixed(4) : unit;
    this.usageMaxFeeAmount = typeof row?.usageMaxFeeAmount === 'number' ? row.usageMaxFeeAmount : null;
  }

  // ── Validation (mirrors SUBSCRIPTION_PRICING_* so the form explains the problem first) ──
  get unitPriceError(): string | null {
    const v = this.usageUnitPrice;
    if (v === null) return null;
    if (!(v > 0)) return 'd3.pricingRow.errors.unitPrice';
    return this.isPercentage && v > 100 ? 'd3.pricingRow.errors.percentMax' : null;
  }

  get capError(): string | null {
    const cap = this.usageMaxFeeAmount;
    if (cap === null) return null;
    return cap > 0 ? null : 'd3.pricingRow.errors.cap';
  }

  get canSubmit(): boolean {
    return !this.submitting
      && this.usageUnitPrice !== null && !this.unitPriceError
      && !this.capError && (!this.isPercentage || this.usageMaxFeeAmount !== null);
  }

  submit(): void {
    if (!this.canSubmit || this.usageUnitPrice === null) return;
    this.submitting = true;
    this.serverError = '';

    this.service.setPricing({
      subscriptionServiceId: this.data.subscriptionServiceId,
      subscriptionServiceTierId: this.tierId,
      period: 'None',
      price: 0,
      usageUnitType: this.usageUnitType,
      // The API takes a rate for PercentageOfValue (0.025), the form takes a percent (2.5).
      usageUnitPrice: this.isPercentage ? +(this.usageUnitPrice / 100).toFixed(6) : this.usageUnitPrice,
      usageMaxFeeAmount: this.usageMaxFeeAmount,
      messagesPerPack: null,
      // The guide calls it optional, but the API rejects the request without it.
      currencyCode: this.existingCurrency ?? 'SAR',
    }).subscribe({
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
