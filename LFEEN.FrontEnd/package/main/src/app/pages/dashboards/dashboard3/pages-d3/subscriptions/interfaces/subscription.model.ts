export type SubscriptionStatus = 'active' | 'suspended' | 'expired';
export type SubscriptionPeriod = 'monthly' | 'annual' | 'free';

export interface SubscriptionServiceItem {
  id: number;
  name: string;
  categoryKey: string;
  icon: string;
  priceValue: number | null;
  period: SubscriptionPeriod;
  startDate: Date;
  endDate: Date;
}

export interface SubscriberAccount {
  id: number;
  facilityName: string;
  classificationKey: string;
  icon: string;
  status: SubscriptionStatus;
  feesAmountValue: number;
  feesPeriod: SubscriptionPeriod;
  feesAnnualValue: number;
  servicesCount: number;
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
  merchantName: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  currencyCode: string;
  status: SubscriptionOrderStatus;
  statusLabel: string;
  requestedAt: string;
  processedAt: string | null;
  items: SubscriptionOrderItem[];
}

// ── /api/subscriptions/catalog ────────────────────────────────
export type SubscriptionCategory = 'Compliance' | 'SmartLock' | 'GovernmentPlatform' | 'Maps' | 'ChannelManager' | 'Messaging' | 'Erp' | 'Payments' | 'Other';

export interface SubscriptionCatalogItem {
  id: number;
  key: string;
  nameAr: string;
  nameEn: string;
  categoryLabel: string;
  logoUrl: string | null;
  isAvailable: boolean;
  isActive: boolean;
  displayOrder: number;
}

// ── /api/subscriptions/pricing ────────────────────────────────
export type SubscriptionPricingPeriod = 'Daily' | 'Monthly' | 'Yearly';

export interface SubscriptionPricingItem {
  id: number;
  subscriptionServiceId: number;
  serviceKey: string;
  serviceName: string;
  period: SubscriptionPricingPeriod | null;
  periodLabel: string | null;
  price: number;
  currencyCode: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface SetSubscriptionPriceRequest {
  subscriptionServiceId: number;
  period: SubscriptionPricingPeriod;
  price: number;
  currencyCode?: string;
}

// ── /api/subscriptions/overview ─────────────────────────────────
export interface SubscriptionOverview {
  activeSubscriptionsCount: number;
  totalMerchantsWithActiveSubscription: number;
  monthlyRevenue: number;
  annualRevenue: number;
  currencyCode: string;
}

export type SubscriptionOfferTone = 'green' | 'blue' | 'purple' | 'orange';
export type SubscriptionOfferBadgeIcon = 'clock' | 'gift' | 'shield-check';
export type SubscriptionOfferBadgeTone = 'green' | 'amber' | 'purple';

export interface SubscriptionOfferCard {
  id: string;
  icon: string;
  tone: SubscriptionOfferTone;
  active: boolean;
  badgeIcon: SubscriptionOfferBadgeIcon;
  badgeTone: SubscriptionOfferBadgeTone;
  /** No badge data comes back from the catalog endpoint — always "-". */
  badgeText: string;
  nameAr: string;
  nameEn: string;
  /** Not returned by the catalog endpoint. */
  desc: string;
  feature1: string;
  feature2: string;
  isFree: boolean;
  monthlyPriceValue: number | null;
  annualPriceValue: number | null;
}

export interface IntegrationField {
  id: number;
  name: string;
  dataType: string;
  required: boolean;
  isNew?: boolean;
  isEditing?: boolean;
}

export interface ServiceOperationPricing {
  id: number;
  nameKey: string;
  setupFee: number;
  operationPrice: number;
  seasonalPrice: number;
}

export type ServiceSubscriptionPlan = 'annualAdvanced' | 'monthly' | 'annualTrial';
export type ServiceSubscriberStatus = 'active' | 'trial';

export interface ServiceSubscribedFacility {
  id: number;
  name: string;
  classificationLabel: string;
  icon: string;
  plan: ServiceSubscriptionPlan;
  startDate: Date;
  renewalDate: Date;
  amountPaid: number | null;
  status: ServiceSubscriberStatus;
}
