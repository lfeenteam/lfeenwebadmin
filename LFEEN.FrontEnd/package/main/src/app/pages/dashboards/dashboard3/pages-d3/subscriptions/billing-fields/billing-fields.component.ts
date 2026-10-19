import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { SubscriptionBillingModel, SubscriptionBillingStyle } from '../interfaces/subscription.model';
import { BillingFormValue, billingFieldsError } from '../interfaces/billing-fields.util';

/**
 * A service's billing setup as the catalog stores it: the type (Paid / Free / BuiltIn, only
 * with `showModel`), how a paid service is charged (Package / Transaction), the one-time setup
 * fee, and the free trial (days for Package, operations for Transaction). Edits `value` in
 * place; the host reads it back and validates with billingFieldsError().
 */
@Component({
  selector: 'app-billing-fields',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TablerIconsModule],
  templateUrl: './billing-fields.component.html',
  styleUrl: './billing-fields.component.scss',
})
export class BillingFieldsComponent {
  private translate = inject(TranslateService);

  @Input({ required: true }) value!: BillingFormValue;
  /** The backend locks the style once the service has any price or period option. */
  @Input() styleLocked = false;
  /** Also render the service type choice (the create dialog has its own select). */
  @Input() showModel = false;
  /** Read-only, e.g. without Subscriptions.ManageCatalog. */
  @Input() disabled = false;
  /** Prefix for input ids, so two instances on one page don't clash. */
  @Input() idPrefix = 'bf';

  readonly models: { value: SubscriptionBillingModel; icon: string }[] = [
    { value: 'Paid', icon: 'credit-card' },
    { value: 'Free', icon: 'gift' },
    { value: 'BuiltIn', icon: 'plug-connected' },
  ];

  readonly styles: { value: SubscriptionBillingStyle; icon: string }[] = [
    { value: 'Package', icon: 'calendar-repeat' },
    { value: 'Transaction', icon: 'receipt' },
  ];

  get error(): string | null {
    return billingFieldsError(this.value);
  }

  get isEn(): boolean {
    return this.translate.currentLang === 'en';
  }

  get currencyIconSrc(): string {
    return this.isEn ? './assets/images/logos/saudi-riyal-en.svg' : './assets/images/logos/saudi-riyal.svg';
  }

  pickModel(model: SubscriptionBillingModel): void {
    if (this.disabled) return;
    this.value.billingModel = model;
  }

  pickStyle(style: SubscriptionBillingStyle): void {
    if (this.styleLocked || this.disabled) return;
    this.value.billingStyle = style;
  }

  /** "Package · setup fee 50 SAR · 14-day trial" — what the merchant will be offered. */
  get summary(): string {
    const v = this.value;
    if (v.billingModel !== 'Paid' || !v.billingStyle) return '';
    const t = (key: string, params?: object) => this.translate.instant(`d3.billingFields.summary.${key}`, params);
    const fmt = (n: number) => n.toLocaleString(this.isEn ? 'en-US' : 'ar-SA', { maximumFractionDigits: 2 });
    const parts = [this.translate.instant(`d3.billingFields.styles.${v.billingStyle}.title`)];

    parts.push(v.hasSetupFee && v.setupFeePrice && v.setupFeePrice > 0
      ? t('setupFee', { amount: fmt(v.setupFeePrice) })
      : t('noSetupFee'));

    const trialCount = v.billingStyle === 'Package' ? v.trialDurationDays : v.trialTransactionCount;
    parts.push(v.hasTrial && trialCount && trialCount > 0
      ? t(v.billingStyle === 'Package' ? 'trialDays' : 'trialCount', { count: fmt(trialCount) })
      : t('noTrial'));

    return parts.join(' · ');
  }
}
