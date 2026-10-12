import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import {
  SetSubscriptionPriceRequest,
  SubscriptionPricingItem,
  SubscriptionPricingPeriod,
  SubscriptionTier,
  SubscriptionUsageUnitType,
} from '../interfaces/subscription.model';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';

export interface PricingRowDialogData {
  subscriptionServiceId: number;
  /** Active tiers; with none (or one) the row is saved on the service's default tier. */
  tiers: SubscriptionTier[];
  /** This service's active rows — picking a tier + period that already has one loads its values. */
  activePricing: SubscriptionPricingItem[];
  currencyCode: string;
  /** Lowest prices POST /pricing accepts for this service (validation floors, not prices). */
  minimumMonthlyPrice?: number | null;
  minimumYearlyPrice?: number | null;
}

/**
 * One full POST /pricing row for a (tier, period): subscription fee, one-time setup fee and
 * the per-transaction usage fee. Saving never edits in place — it creates a new row and
 * closes the active one for the same combination.
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

  readonly periods: SubscriptionPricingPeriod[] = ['Monthly', 'Yearly', 'Daily'];
  readonly usageUnitTypes: SubscriptionUsageUnitType[] = ['None', 'PerUnit', 'PercentageOfValue'];

  /** 'default' rather than null: mat-select renders a null value as an empty field. */
  tierSelection: number | 'default' = 'default';
  period: SubscriptionPricingPeriod = 'Monthly';
  price: number | null = null;
  setupFee: number | null = null;
  usageUnitType: SubscriptionUsageUnitType = 'None';
  /** PerUnit: SAR per transaction. PercentageOfValue: a percent (2.5 = 2.5%). */
  usageUnitPrice: number | null = null;
  usageMaxFeeAmount: number | null = null;

  /** true when the chosen tier + period already has an active row, which saving will replace. */
  replacesExisting = false;
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

  get hasUsageFee(): boolean {
    return this.usageUnitType !== 'None';
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

  // Fills the form from the active row of the chosen tier + period, so changing one fee
  // doesn't silently drop the others when the row is replaced.
  loadExisting(): void {
    const tier = this.tierId;
    const defaultTierId = this.data.tiers.find(t => t.isDefault)?.id ?? null;
    const row = this.data.activePricing.find(p => p.period === this.period && (
      tier === null
        ? p.subscriptionServiceTierId == null || p.subscriptionServiceTierId === defaultTierId
        : p.subscriptionServiceTierId === tier
    ));

    this.replacesExisting = !!row;
    this.price = row?.price ?? null;
    this.setupFee = typeof row?.setupFee === 'number' ? row.setupFee : null;
    const type = row?.usageUnitType;
    this.usageUnitType = type === 'PerUnit' || type === 'PercentageOfValue' ? type : 'None';
    const unit = typeof row?.usageUnitPrice === 'number' ? row.usageUnitPrice : null;
    this.usageUnitPrice = unit === null ? null : this.isPercentage ? +(unit * 100).toFixed(4) : unit;
    this.usageMaxFeeAmount = typeof row?.usageMaxFeeAmount === 'number' ? row.usageMaxFeeAmount : null;
  }

  // ── Validation (the server returns a single message, so everything is checked here) ──
  private get minimumPrice(): number | null {
    if (this.period === 'Monthly') return this.data.minimumMonthlyPrice ?? null;
    if (this.period === 'Yearly') return this.data.minimumYearlyPrice ?? null;
    return null;
  }

  // A paid service's price must be above zero — except when it charges a usage fee instead,
  // where a 0 subscription fee is allowed (rule 6 of the free-services guide).
  get priceError(): string | null {
    const p = this.price;
    if (p === null) return null;
    if (this.hasUsageFee ? p < 0 : !(p > 0)) return 'd3.pricingRow.errors.price';
    const min = this.minimumPrice;
    return min !== null && p < min ? 'd3.pricingRow.errors.belowMinimum' : null;
  }

  get minimumPriceLabel(): number | null {
    return this.minimumPrice;
  }

  get setupFeeInvalid(): boolean {
    return this.setupFee !== null && !(this.setupFee >= 0);
  }

  get usageError(): string | null {
    if (!this.hasUsageFee) return null;
    const v = this.usageUnitPrice;
    if (v === null || !(v > 0)) return 'd3.subscriptions.serviceSettings.usage.errors.unitPrice';
    if (this.isPercentage) {
      if (v > 100) return 'd3.discountCodes.create.errors.percentMax';
      if (this.usageMaxFeeAmount === null || !(this.usageMaxFeeAmount > 0)) return 'd3.subscriptions.serviceSettings.usage.errors.cap';
    }
    return null;
  }

  get canSubmit(): boolean {
    return !this.submitting && this.price !== null && !this.priceError && !this.setupFeeInvalid && !this.usageError;
  }

  submit(): void {
    if (!this.canSubmit || this.price === null) return;
    this.submitting = true;
    this.serverError = '';

    const body: SetSubscriptionPriceRequest = {
      subscriptionServiceId: this.data.subscriptionServiceId,
      subscriptionServiceTierId: this.tierId,
      period: this.period,
      price: this.price,
      setupFee: this.setupFee ?? 0,
      currencyCode: this.data.currencyCode,
    };
    if (this.hasUsageFee && this.usageUnitPrice !== null) {
      body.usageUnitType = this.usageUnitType;
      // The API takes a rate for PercentageOfValue (0.025), the form takes a percent (2.5).
      body.usageUnitPrice = this.isPercentage ? +(this.usageUnitPrice / 100).toFixed(6) : this.usageUnitPrice;
      body.usageMaxFeeAmount = this.isPercentage ? this.usageMaxFeeAmount : null;
    }

    this.service.setPricing(body).subscribe({
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
