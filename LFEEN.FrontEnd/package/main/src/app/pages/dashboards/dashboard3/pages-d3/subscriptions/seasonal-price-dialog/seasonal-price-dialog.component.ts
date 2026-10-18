import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import { SubscriptionPricingPeriod, SubscriptionTier } from '../interfaces/subscription.model';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';
import { SingleDateCalendarComponent } from '../../all-bookings/components/single-date-calendar/single-date-calendar.component';

export interface SeasonalPriceDialogData {
  subscriptionServiceId: number;
  /** Periods that currently have an active price — a seasonal price replaces one of them. */
  periods: SubscriptionPricingPeriod[];
  /** Active tiers; empty = the service only has its default tier. */
  tiers: SubscriptionTier[];
  /** Set when opened from a pricing row: the tier is then fixed (null = default tier). */
  tierId?: number | null;
  currencyCode: string;
}

@Component({
  selector: 'app-seasonal-price-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TranslateModule, TablerIconsModule, SingleDateCalendarComponent],
  templateUrl: './seasonal-price-dialog.component.html',
  styleUrls: ['../subscription-discount-codes/create-discount-code-dialog/create-discount-code-dialog.component.scss'],
})
export class SeasonalPriceDialogComponent {
  private translate = inject(TranslateService);
  private service = inject(SubscriptionsService);

  period: SubscriptionPricingPeriod;
  /** 'default' rather than null: mat-select renders a null value as an empty field. */
  tierSelection: number | 'default' = 'default';
  nameAr = '';
  nameEn = '';
  startDate = '';
  endDate = '';
  price: number | null = null;

  submitting = false;
  serverError = '';

  constructor(
    public dialogRef: MatDialogRef<SeasonalPriceDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: SeasonalPriceDialogData,
  ) {
    this.period = data.periods[0] ?? 'Monthly';
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.translate.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get todayIso(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  tierName(t: SubscriptionTier): string {
    return this.translate.currentLang === 'en' ? t.nameEn : t.nameAr;
  }

  periodLabel(p: SubscriptionPricingPeriod): string {
    return this.translate.instant(`d3.subscriptionLog.detailValues.${p}`);
  }

  dateLabel(value: string): string {
    if (!value) return this.translate.instant('d3.discountCodes.create.pickDate');
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-EG', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  get priceInvalid(): boolean {
    return this.price !== null && !(this.price > 0);
  }

  get datesInvalid(): boolean {
    return !!this.startDate && !!this.endDate && this.endDate < this.startDate;
  }

  get canSubmit(): boolean {
    return !this.submitting && !!this.nameAr.trim() && !!this.nameEn.trim()
      && !!this.startDate && !!this.endDate && !this.datesInvalid
      && this.price !== null && !this.priceInvalid;
  }

  submit(): void {
    if (!this.canSubmit || this.price === null) return;
    this.submitting = true;
    this.serverError = '';
    this.service.createSeasonalPrice({
      subscriptionServiceId: this.data.subscriptionServiceId,
      subscriptionServiceTierId: this.data.tierId !== undefined
        ? this.data.tierId
        : this.tierSelection === 'default' ? null : this.tierSelection,
      period: this.period,
      nameAr: this.nameAr.trim(),
      nameEn: this.nameEn.trim(),
      startDate: this.startDate,
      endDate: this.endDate,
      price: this.price,
      currencyCode: this.data.currencyCode,
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.dialogRef.close(true);
      },
      error: err => {
        // e.g. SUBSCRIPTION_SEASONAL_PRICE_OVERLAPS — the server message explains which window clashes.
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
