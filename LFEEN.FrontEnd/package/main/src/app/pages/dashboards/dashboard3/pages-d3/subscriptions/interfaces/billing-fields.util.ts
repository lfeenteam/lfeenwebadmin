import { SubscriptionBillingModel, SubscriptionBillingStyle } from './subscription.model';

/** The catalog's billing fields as a form holds them (null = empty input). */
export interface BillingFormValue {
  billingModel: SubscriptionBillingModel;
  billingStyle: SubscriptionBillingStyle | null;
  hasSetupFee: boolean;
  setupFeePrice: number | null;
  hasTrial: boolean;
  trialDurationDays: number | null;
  trialTransactionCount: number | null;
}

export type BillingRequestFields = Pick<BillingFormValue,
  'billingStyle' | 'hasSetupFee' | 'setupFeePrice' | 'hasTrial' | 'trialDurationDays' | 'trialTransactionCount'>;

const isPositiveInt = (v: number | null) => v !== null && Number.isInteger(v) && v > 0;

/**
 * Mirrors the backend's catalog rules so the form says what's wrong before the request:
 * Paid needs a style, a setup fee needs a price > 0, a trial needs days (Package) or an
 * operation count (Transaction), and neither fee nor trial exist on Free / BuiltIn.
 * Returns a translation key under d3.billingFields.errors, or null when valid.
 */
export function billingFieldsError(v: BillingFormValue): string | null {
  if (v.billingModel !== 'Paid') return null;
  if (!v.billingStyle) return 'd3.billingFields.errors.styleRequired';
  if (v.hasSetupFee && !(v.setupFeePrice !== null && v.setupFeePrice > 0)) return 'd3.billingFields.errors.setupFee';
  if (v.hasTrial && v.billingStyle === 'Package' && !isPositiveInt(v.trialDurationDays)) return 'd3.billingFields.errors.trialDays';
  if (v.hasTrial && v.billingStyle === 'Transaction' && !isPositiveInt(v.trialTransactionCount)) return 'd3.billingFields.errors.trialCount';
  return null;
}

/** What the API accepts: style, fee and trial are only sent for Paid, and only the trial field that matches the style. */
export function billingRequestFields(v: BillingFormValue): BillingRequestFields {
  const paid = v.billingModel === 'Paid';
  const hasSetupFee = paid && v.hasSetupFee;
  const hasTrial = paid && v.hasTrial;
  return {
    billingStyle: paid ? v.billingStyle : null,
    hasSetupFee,
    setupFeePrice: hasSetupFee ? v.setupFeePrice : null,
    hasTrial,
    trialDurationDays: hasTrial && v.billingStyle === 'Package' ? v.trialDurationDays : null,
    trialTransactionCount: hasTrial && v.billingStyle === 'Transaction' ? v.trialTransactionCount : null,
  };
}
