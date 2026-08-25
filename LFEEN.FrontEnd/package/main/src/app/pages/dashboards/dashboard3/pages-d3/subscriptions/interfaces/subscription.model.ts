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
  serviceName: string;
  serviceIcon: string;
  actorName: string;
  actorInitial: string;
  date: Date;
  status: SubscriptionLogStatus;
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
  isFree: boolean;
  monthlyPriceValue: number;
  annualPriceValue: number;
}

export interface IntegrationField {
  id: number;
  name: string;
  dataType: string;
  required: boolean;
  isNew?: boolean;
  isEditing?: boolean;
}

export interface AccountTypeFeeRule {
  id: number;
  icon: string;
  iconImage?: string;
  name: string;
  desc: string;
  adjustmentPercent: number;
  active: boolean;
  isEditing?: boolean;
}

export type ServiceSubscriptionPlan = 'annualAdvanced' | 'monthly' | 'annualTrial';
export type ServiceSubscriberStatus = 'active' | 'trial';

export interface ServiceSubscribedFacility {
  id: number;
  name: string;
  classificationLabel: string;
  icon: string;
  plan: ServiceSubscriptionPlan;
  subscribeDate: Date;
  startDate: Date;
  amountPaid: number | null;
  status: ServiceSubscriberStatus;
}
