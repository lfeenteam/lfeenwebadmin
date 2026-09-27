import { SubscriptionOfferTone } from './subscription.model';

export interface ServiceVisual {
  icon: string;
  tone: SubscriptionOfferTone;
}

// The catalog has no branding field besides logoUrl (null for most services), so each
// known service key gets its own icon. `key` is fixed once a service is created.
const VISUAL_BY_KEY: Record<string, ServiceVisual> = {
  zatca: { icon: 'receipt-tax', tone: 'purple' },
  wathq: { icon: 'certificate', tone: 'blue' },
  nafath: { icon: 'fingerprint', tone: 'green' },
  absher: { icon: 'id-badge-2', tone: 'green' },
  ministryOfTourism: { icon: 'building-bank', tone: 'blue' },
  googleMaps: { icon: 'map-pin', tone: 'blue' },
  smsGateway: { icon: 'message-2', tone: 'orange' },
  channelManager: { icon: 'link', tone: 'orange' },
  externalErp: { icon: 'building-warehouse', tone: 'purple' },
  whatsappBusinessApi: { icon: 'brand-whatsapp', tone: 'green' },
  buyNowPayLater: { icon: 'credit-card', tone: 'blue' },
};

/** Raw category keys, as the catalog POST/PUT accepts them. */
export const SUBSCRIPTION_CATEGORY_KEYS = ['Compliance', 'SmartLock', 'GovernmentPlatform', 'Maps', 'ChannelManager', 'Messaging', 'Erp', 'Payments', 'Other'] as const;

const VISUAL_BY_CATEGORY: Record<string, ServiceVisual> = {
  Compliance: { icon: 'receipt-tax', tone: 'purple' },
  SmartLock: { icon: 'lock', tone: 'orange' },
  GovernmentPlatform: { icon: 'building-bank', tone: 'blue' },
  Maps: { icon: 'map-pin', tone: 'blue' },
  ChannelManager: { icon: 'link', tone: 'orange' },
  Messaging: { icon: 'message-2', tone: 'green' },
  Erp: { icon: 'building-warehouse', tone: 'purple' },
  Payments: { icon: 'credit-card', tone: 'blue' },
  Other: { icon: 'apps', tone: 'orange' },
};

// categoryLabel comes back translated per Accept-Language — both languages map to the raw key.
const CATEGORY_BY_LABEL: Record<string, string> = {
  'الامتثال الضريبي': 'Compliance',
  'منصة حكومية': 'GovernmentPlatform',
  'الخرائط': 'Maps',
  'المراسلة': 'Messaging',
  'مدير القنوات': 'ChannelManager',
  'أنظمة إدارة الموارد': 'Erp',
  'المدفوعات': 'Payments',
  'الأقفال الذكية': 'SmartLock',
  'أخرى': 'Other',
  'tax compliance': 'Compliance',
  'compliance': 'Compliance',
  'government platform': 'GovernmentPlatform',
  'maps': 'Maps',
  'messaging': 'Messaging',
  'channel manager': 'ChannelManager',
  'erp': 'Erp',
  'payments': 'Payments',
  'smart lock': 'SmartLock',
  'other': 'Other',
};

/** Translated categoryLabel (or a raw key) → raw category key, or null when unknown. */
export function categoryKeyFromLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const trimmed = label.trim();
  const direct = SUBSCRIPTION_CATEGORY_KEYS.find(k => k.toLowerCase() === trimmed.toLowerCase());
  return direct ?? CATEGORY_BY_LABEL[trimmed] ?? CATEGORY_BY_LABEL[trimmed.toLowerCase()] ?? null;
}

export function serviceVisual(key: string | null | undefined, categoryLabel?: string | null): ServiceVisual {
  if (key && VISUAL_BY_KEY[key]) return VISUAL_BY_KEY[key];
  const category = categoryKeyFromLabel(categoryLabel);
  return (category && VISUAL_BY_CATEGORY[category]) || VISUAL_BY_CATEGORY['Other'];
}
