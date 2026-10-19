// Mirrors LFEENAdmin.API's /api/subscriptions surface (Package/Transaction pricing model).
// Every enum travels as a string.

export type SubscriptionStatus = 'active' | 'suspended' | 'expired';
export type SubscriptionBillingModel = 'Paid' | 'Free' | 'BuiltIn';
/** Only meaningful when billingModel is Paid. Locked once any price / period option exists. */
export type SubscriptionBillingStyle = 'Package' | 'Transaction';

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
  billingModel: SubscriptionBillingModel;
  statusLabel: string;
}

export interface SubscriberAccount {
  id: string;
  facilityName: string;
  status: SubscriptionStatus;
  statusLabel: string;
  feesAmountValue: number;
  feesAnnualValue: number;
  services: SubscriptionServiceItem[];
}

// ── /api/subscriptions/requests (read-only history) ──────────
export type SubscriptionOrderStatus = 'Pending' | 'Succeeded' | 'Failed';

export interface SubscriptionOrderItem {
  subscriptionServiceId: number;
  serviceKey: string;
  serviceName: string;
  requestTypeLabel: string;
  /** "None" on Package / Transaction lines — periodLabel carries the chosen option's own name. */
  period: string | null;
  periodLabel: string | null;
  /** Subscription-fee component only; the line total is amount + setupFeeAmount - discountAmount. */
  amount: number;
  usageUnitType?: SubscriptionUsageUnitType | null;
  usageUnitPrice?: number | null;
  setupFeeAmount: number;
  discountAmount: number;
  discountCode: string | null;
  propertyId: number | null;
  propertyName: string | null;
  tierKey: string | null;
  tierName: string | null;
  billingModel: SubscriptionBillingModel;
  lineStatus: string | null;
}

export interface SubscriptionOrder {
  orderId: string;
  accountId: string;
  merchantName: string | null;
  /** Always equal to totalAmount — there's no tax split. */
  subtotalAmount: number;
  totalAmount: number;
  currencyCode: string;
  status: string | null;
  statusLabel: string;
  requestedAt: string;
  processedAt: string | null;
  items: SubscriptionOrderItem[];
}

// ── /api/subscriptions/catalog ────────────────────────────────
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
  /** Localized; the raw category isn't returned. */
  categoryLabel: string;
  logoUrl: string | null;
  isAvailable: boolean;
  isActive: boolean;
  displayOrder: number;
  /** Active bullets only, already in display order. */
  features?: SubscriptionServiceFeature[];
  billingModel: SubscriptionBillingModel;
  /** null unless billingModel is Paid. */
  billingStyle: SubscriptionBillingStyle | null;
  hasSetupFee: boolean;
  setupFeePrice: number | null;
  hasTrial: boolean;
  /** Package trials. */
  trialDurationDays: number | null;
  /** Transaction trials. */
  trialTransactionCount: number | null;
  isFree: boolean;
  isBuiltIn: boolean;
}

/** Shared by POST and PUT /catalog. */
interface SubscriptionServiceFields {
  nameAr: string;
  nameEn: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  category: string | null;
  logoUrl: string | null;
  isAvailable: boolean;
  billingStyle: SubscriptionBillingStyle | null;
  hasSetupFee: boolean;
  setupFeePrice: number | null;
  hasTrial: boolean;
  trialDurationDays: number | null;
  trialTransactionCount: number | null;
}

/** `key` is set once here and never changes; displayOrder is assigned by the backend. */
export interface CreateSubscriptionServiceRequest extends SubscriptionServiceFields {
  key: string;
  billingModel: SubscriptionBillingModel;
}

/** PUT /catalog/{id} is a full replace. billingModel: null = leave unchanged. */
export interface UpdateSubscriptionServiceRequest extends SubscriptionServiceFields {
  isActive: boolean;
  displayOrder: number;
  billingModel: SubscriptionBillingModel | null;
}

// ── /api/subscriptions/pricing (Transaction rate & MessagePack only) ──
/** None = a Transaction-style per-operation rate. */
export type SubscriptionPricingPeriod = 'None' | 'MessagePack';
export type SubscriptionUsageUnitType = 'None' | 'PerUnit' | 'PercentageOfValue';

export interface SubscriptionPricingItem {
  id: number;
  subscriptionServiceId: number;
  serviceKey: string;
  serviceName: string;
  period: SubscriptionPricingPeriod | string | null;
  periodLabel: string | null;
  /** 0 on Transaction rows; the pack price on MessagePack rows. */
  price: number;
  currencyCode: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** null = the service's default tier. */
  subscriptionServiceTierId: number | null;
  tierKey: string | null;
  tierName: string | null;
  usageUnitType: SubscriptionUsageUnitType | null;
  /** PerUnit: amount per unit. PercentageOfValue: a rate (0.025 = 2.5%). */
  usageUnitPrice: number | null;
  /** Required for PercentageOfValue: the most one operation can be charged. */
  usageMaxFeeAmount: number | null;
  /** MessagePack only: messages one pack buys (also the smallest top-up). */
  messagesPerPack: number | null;
}

/** Never edits in place: closes the active row for the same (service, tier, period) and opens a new one. */
export interface SetSubscriptionPriceRequest {
  subscriptionServiceId: number;
  subscriptionServiceTierId: number | null;
  period: SubscriptionPricingPeriod;
  price: number;
  usageUnitType: SubscriptionUsageUnitType | null;
  usageUnitPrice: number | null;
  usageMaxFeeAmount: number | null;
  messagesPerPack: number | null;
  currencyCode?: string;
}

// ── /api/subscriptions/period-options (Package-style price list) ──
export interface SubscriptionPeriodOption {
  id: number;
  subscriptionServiceId: number;
  serviceKey: string;
  serviceName: string;
  durationInDays: number;
  nameAr: string;
  nameEn: string;
  price: number;
  currencyCode: string;
  displayOrder: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  subscriptionServiceTierId: number | null;
  tierKey: string | null;
  tierName: string | null;
}

export interface CreatePeriodOptionRequest {
  subscriptionServiceId: number;
  subscriptionServiceTierId: number | null;
  durationInDays: number;
  nameAr: string;
  nameEn: string;
  price: number;
  displayOrder: number;
  currencyCode?: string;
}

/** PUT supersedes: the row in the route is closed and a new one (new id) is returned. */
export type UpdatePeriodOptionRequest = Omit<CreatePeriodOptionRequest, 'subscriptionServiceId' | 'subscriptionServiceTierId'>;

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
/** NotSubscribed | Active | Expired */
export interface MerchantSubscriptionLine {
  subscriptionServiceId?: number;
  serviceKey?: string | null;
  serviceName?: string | null;
  categoryLabel?: string | null;
  subscriptionServiceTierId?: number | null;
  tierName?: string | null;
  period?: string | null;
  periodLabel?: string | null;
  usageUnitType?: SubscriptionUsageUnitType | null;
  usageUnitPrice?: number | null;
  /** Package: the option actually bought (a snapshot). Transaction / MessagePack: today's price. Free: null. */
  price?: number | null;
  currencyCode?: string;
  startDate?: string | null;
  expiresAt?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  propertyId?: number | null;
  propertyName?: string | null;
  propertyClassification?: string | null;
  /** Snapshotted at subscribe time. */
  billingModel?: SubscriptionBillingModel;
}

export interface ServiceSubscriber extends MerchantSubscriptionLine {
  accountId?: string;
  merchantName?: string | null;
}

export interface MerchantSubscription {
  accountId: string;
  merchantName?: string | null;
  /** "Active" if any service is active, "Expired" otherwise. */
  overallStatus?: string | null;
  overallStatusLabel?: string | null;
  activeServiceCount?: number;
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
}

export interface CreateSubscriptionTierRequest {
  subscriptionServiceId: number;
  key: string;
  nameAr: string;
  nameEn: string;
  /** true moves the default flag off whichever tier had it. */
  isDefault: boolean;
  displayOrder: number;
}

// ── /api/subscriptions/features (catalog card bullets) ────────
export interface CreateSubscriptionFeatureRequest {
  subscriptionServiceId: number;
  textAr: string;
  textEn: string;
}

// ── /api/subscriptions/discount-codes (Package-style lines only) ──
export type SubscriptionDiscountType = 'Percentage' | 'FixedAmount';

export interface SubscriptionDiscountCode {
  id: number;
  code: string;
  /** null = valid for every Package-style service. */
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
  /** All zeros for platform-level changes (catalog / pricing edits). */
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

/** What the merchant pays for one order line — `amount` alone is only the subscription fee. */
export const subscriptionLineTotal = (i: SubscriptionOrderItem): number =>
  i.amount + i.setupFeeAmount - i.discountAmount;

// ── /api/subscriptions/overview ─────────────────────────────────
export interface SubscriptionOverview {
  activeSubscriptionsCount: number;
  totalMerchantsWithActiveSubscription: number;
  monthlyRevenue: number;
  annualRevenue: number;
  currencyCode: string;
  freeSubscriptionsCount: number;
  misconfiguredServicesCount: number;
}

export type SubscriptionOfferTone = 'green' | 'blue' | 'purple' | 'orange';

/** How a card prices itself: from its period options, its per-operation rate, or its message pack. */
export type OfferPriceKind = 'package' | 'transaction' | 'messagePack' | 'free' | 'builtIn';

export interface SubscriptionOfferCard {
  id: string;
  icon: string;
  tone: SubscriptionOfferTone;
  active: boolean;
  /** false = exists but merchants can't subscribe right now (shown as "coming soon"). */
  available: boolean;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  features: { textAr: string; textEn: string }[];
  billingModel?: SubscriptionBillingModel;
  billingStyle: SubscriptionBillingStyle | null;
  priceKind: OfferPriceKind;
  /** Package: cheapest active period option and how many options are on offer. */
  fromPrice: number | null;
  optionsCount: number;
  /** Transaction: the default tier's active rate (an amount, or a percent already ×100) and its cap. */
  rateAmount: number | null;
  ratePercent: number | null;
  rateCap: number | null;
  /** MessagePack: active pack price and its size. */
  packPrice: number | null;
  messagesPerPack: number | null;
  /** Trial badge text pieces — at most one is set. */
  trialDays: number | null;
  trialTransactions: number | null;
}
