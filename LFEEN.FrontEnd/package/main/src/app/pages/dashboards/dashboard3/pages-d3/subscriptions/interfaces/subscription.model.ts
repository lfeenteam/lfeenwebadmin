export type SubscriptionStatus = 'active' | 'suspended' | 'expired';
export type SubscriptionPeriod = 'monthly' | 'annual' | 'free';

export interface SubscriptionServiceItem {
  name: string;
  /** Already-translated category label from the API ('-' when missing). */
  categoryLabel: string;
  icon: string;
  priceValue: number | null;
  periodLabel: string;
  startDate: string;
  endDate: string;
  expired: boolean;
}

export interface SubscriberAccount {
  id: string;
  facilityName: string;
  status: SubscriptionStatus;
  feesAmountValue: number;
  feesAnnualValue: number;
  services: SubscriptionServiceItem[];
}

export type SubscriptionLogActionType = 'renew' | 'add' | 'cancel';
export type SubscriptionLogStatus = 'completed' | 'processing' | 'cancelled';

export interface SubscriptionLogEntry {
  id: number;
  refNumber: string;
  actionType: SubscriptionLogActionType;
  /** Display text as returned by the API (requestTypeLabel isn't a fixed enum, so actionType above is only used for badge color). */
  actionLabel: string;
  serviceName: string;
  serviceIcon: string;
  actorName: string;
  actorInitial: string;
  date: Date;
  status: SubscriptionLogStatus;
}

// ── /api/subscriptions/requests ──────────────────────────────
// Only UnderReview (the endpoint's default) is confirmed by the backend; the rest are the
// expected EQAMATIK values. Raw status can also arrive as a numeric string, so logic must
// treat anything unknown defensively.
export type SubscriptionOrderStatus = 'Pending' | 'UnderReview' | 'Approved' | 'Rejected';

export interface SubscriptionOrderItem {
  subscriptionServiceId: number;
  serviceKey: string;
  serviceName: string;
  requestTypeLabel: string;
  periodLabel: string | null;
  amount: number;
  setupFeeAmount: number;
  discountAmount: number;
  discountCode: string | null;
  propertyId: number | null;
  propertyName: string | null;
  tierKey: string | null;
  tierName: string | null;
}

export interface SubscriptionOrder {
  orderId: string;
  accountId: string;
  merchantName: string | null;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  currencyCode: string;
  status: string | null;
  statusLabel: string;
  requestedAt: string;
  processedAt: string | null;
  items: SubscriptionOrderItem[];
}

// ── /api/subscriptions/catalog ────────────────────────────────
export type SubscriptionCategory = 'Compliance' | 'SmartLock' | 'GovernmentPlatform' | 'Maps' | 'ChannelManager' | 'Messaging' | 'Erp' | 'Payments' | 'Other';

export interface SubscriptionServiceFeature {
  id: number;
  subscriptionServiceId?: number;
  textAr: string;
  textEn: string;
  isActive: boolean;
  displayOrder?: number;
}

export interface SubscriptionCatalogItem {
  id: number;
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  categoryLabel: string;
  logoUrl: string | null;
  isAvailable: boolean;
  isActive: boolean;
  displayOrder: number;
  /** Validation floors for POST /pricing — not prices. */
  minimumMonthlyPrice?: number | null;
  minimumYearlyPrice?: number | null;
  /** true = VAT is already inside the price; false = VAT is added on top. */
  isPriceVatInclusive?: boolean;
  // ── Read-only, computed by the backend (never sent back on PUT) ──
  /** Active checkmark bullets, already in display order. */
  features?: SubscriptionServiceFeature[];
  /** Default tier's current effective price (a seasonal override wins); null = no active pricing. */
  monthlyPrice?: number | null;
  yearlyPrice?: number | null;
  currencyCode?: string;
  /** Default tier's free-trial length; 0 = no trial. */
  trialDays?: number;
}

// ── /api/subscriptions/pricing ────────────────────────────────
export type SubscriptionPricingPeriod = 'Daily' | 'Monthly' | 'Yearly';
export type SubscriptionUsageUnitType = 'None' | 'PerUnit' | 'PercentageOfValue';

export interface SubscriptionPricingItem {
  id: number;
  subscriptionServiceId: number;
  /** null = the service's default tier. */
  subscriptionServiceTierId?: number | null;
  tierName?: string | null;
  serviceKey: string;
  serviceName: string;
  period: SubscriptionPricingPeriod | null;
  periodLabel: string | null;
  /** Recurring subscription fee. */
  price: number;
  /** One-time fee, charged only on a merchant's first subscription to the service. */
  setupFee?: number | null;
  usageUnitType?: SubscriptionUsageUnitType | null;
  /** PerUnit: flat amount per unit. PercentageOfValue: a rate (0.025 = 2.5%). */
  usageUnitPrice?: number | null;
  usageMaxFeeAmount?: number | null;
  currencyCode: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  // Seasonal override active right now for this exact (service, tier, period) — all null otherwise.
  seasonalPriceId?: number | null;
  seasonalPrice?: number | null;
  seasonalPriceNameAr?: string | null;
  seasonalPriceNameEn?: string | null;
  seasonalPriceStartDate?: string | null;
  seasonalPriceEndDate?: string | null;
}

/**
 * POST /pricing never edits in place: it creates a new row and closes the active one for the
 * same (service, tier, period). Every fee the old row had must be resent or it's lost.
 */
export interface SetSubscriptionPriceRequest {
  subscriptionServiceId: number;
  subscriptionServiceTierId?: number | null;
  period: SubscriptionPricingPeriod;
  price: number;
  setupFee?: number | null;
  usageUnitType?: SubscriptionUsageUnitType | null;
  usageUnitPrice?: number | null;
  usageMaxFeeAmount?: number | null;
  currencyCode?: string;
}

/** PUT /catalog/{id} is a full replace — every field must be sent, including unchanged ones. */
export interface UpdateSubscriptionServiceRequest {
  nameAr: string;
  nameEn: string;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  category: string | null;
  logoUrl: string | null;
  isAvailable: boolean;
  isActive: boolean;
  displayOrder: number;
  minimumMonthlyPrice?: number | null;
  minimumYearlyPrice?: number | null;
  isPriceVatInclusive?: boolean;
}

// ── /api/subscriptions/{id}/integration-fields ────────────────
export type IntegrationFieldType = 'Text' | 'Secret' | 'Url';

/** Schema only — the values merchants submit are never exposed to the admin API. */
export interface SubscriptionIntegrationField {
  id: number;
  subscriptionServiceId: number;
  key: string;
  labelAr: string;
  labelEn: string;
  fieldType: IntegrationFieldType | string;
  isRequired: boolean;
  isActive?: boolean;
  displayOrder?: number;
}

export interface CreateIntegrationFieldRequest {
  subscriptionServiceId: number;
  key: string;
  labelAr: string;
  labelEn: string;
  fieldType: IntegrationFieldType;
  isRequired: boolean;
}

// ── /api/subscriptions/{id}/subscribers & /merchant-subscriptions ──
// The guide describes these two endpoints but doesn't list their response fields. The names
// below are the ones it mentions plus the conventions of the order DTOs, all optional so a
// mismatch degrades to "-" instead of breaking — verify against the real response.
export interface MerchantSubscriptionLine {
  subscriptionServiceId?: number;
  serviceKey?: string | null;
  serviceName?: string | null;
  categoryLabel?: string | null;
  tierName?: string | null;
  period?: string | null;
  periodLabel?: string | null;
  /** Today's active price for the line — not necessarily what the merchant was charged. */
  price?: number | null;
  currencyCode?: string;
  /** Start of the current billing cycle (computed), not the first-ever subscription date. */
  startDate?: string | null;
  expiresAt?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  propertyId?: number | null;
  propertyName?: string | null;
  propertyClassification?: string | null;
}

export interface ServiceSubscriber extends MerchantSubscriptionLine {
  accountId?: string;
  merchantName?: string | null;
}

export interface MerchantSubscription {
  accountId: string;
  merchantName?: string | null;
  /** "Active" if any service is active, "Expired" if all lapsed. */
  overallStatus?: string | null;
  monthlyEquivalentTotal?: number | null;
  annualEquivalentTotal?: number | null;
  currencyCode?: string;
  services?: MerchantSubscriptionLine[];
}

// ── /api/subscriptions/tiers ──────────────────────────────────
export interface SubscriptionTier {
  id: number;
  subscriptionServiceId: number;
  serviceKey: string;
  serviceName: string;
  key: string;
  nameAr: string;
  nameEn: string;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
  trialDays: number;
}

// ── /api/subscriptions/discount-codes ─────────────────────────
export type SubscriptionDiscountType = 'Percentage' | 'FixedAmount';

export interface SubscriptionDiscountCode {
  id: number;
  code: string;
  /** null = valid for every service. */
  subscriptionServiceId: number | null;
  serviceName: string | null;
  discountType: string | null;
  discountValue: number;
  maxDiscountAmount: number | null;
  appliesToSubscriptionFee: boolean;
  appliesToSetupFee: boolean;
  maxRedemptions: number | null;
  redemptionCount: number;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
}

export interface CreateSubscriptionDiscountCodeRequest {
  code: string;
  subscriptionServiceId: number | null;
  discountType: SubscriptionDiscountType;
  discountValue: number;
  maxDiscountAmount: number | null;
  appliesToSubscriptionFee: boolean;
  appliesToSetupFee: boolean;
  maxRedemptions: number | null;
  validFrom: string | null;
  validTo: string | null;
}

/** Computed client-side — the API only returns isActive + the raw dates/counters. */
export type DiscountCodeState = 'active' | 'scheduled' | 'exhausted' | 'expired' | 'disabled';

// ── /api/subscriptions/activity-log ───────────────────────────
export interface SubscriptionAuditLog {
  id: number;
  accountId: string;
  merchantName: string | null;
  subscriptionServiceId: number | null;
  serviceName: string | null;
  subscriptionOrderId: string | null;
  subscriptionRequestId: number | null;
  action: string | null;
  actorType: string | null;
  actorUserId: string | null;
  details: string | null;
  createdAt: string;
}

export interface SubscriptionActivityLogQuery {
  accountId?: string;
  subscriptionServiceId?: number;
  pageNumber?: number;
  pageSize?: number;
}

export interface SubscriptionPaginated<T> {
  data: T[];
  totalCount: number;
  page: number;
  /** Lowercase "p" as the backend sends it; null on the last page. */
  nextpage: number | null;
  totalPages: number;
}

/** What the admin actually pays for one order line — `amount` alone is only the subscription fee. */
export const subscriptionLineTotal = (i: SubscriptionOrderItem): number =>
  i.amount + i.setupFeeAmount - i.discountAmount;

// ── /api/subscriptions/overview ─────────────────────────────────
export interface SubscriptionOverview {
  activeSubscriptionsCount: number;
  totalMerchantsWithActiveSubscription: number;
  monthlyRevenue: number;
  annualRevenue: number;
  currencyCode: string;
}

export type SubscriptionOfferTone = 'green' | 'blue' | 'purple' | 'orange';

export interface SubscriptionOfferCard {
  id: string;
  icon: string;
  tone: SubscriptionOfferTone;
  active: boolean;
  /** Default tier's free-trial days; 0 hides the badge. */
  trialDays: number;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  features: { textAr: string; textEn: string }[];
  /** null = no active pricing for that period; 0 = free. */
  monthlyPriceValue: number | null;
  annualPriceValue: number | null;
}
