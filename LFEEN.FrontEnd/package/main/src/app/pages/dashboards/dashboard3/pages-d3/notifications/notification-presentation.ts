import {
  AdminNotification,
  NotificationCategory,
  NotificationSeverity,
} from '../../interfaces/admin-notification.model';

interface TypePresentation {
  category: Exclude<NotificationCategory, 'all'>;
  icon: string;
  severity: NotificationSeverity;
}

// Frontend-owned display catalog. Types missing here (future backend additions)
// fall back to DEFAULT_PRESENTATION and only show under the "all" tab.
const TYPE_PRESENTATION: Record<string, TypePresentation> = {
  ComplaintCreated:              { category: 'complaints', icon: 'message-report',   severity: 'error' },
  BookingIssueReported:          { category: 'complaints', icon: 'calendar-event',   severity: 'error' },
  PropertyReviewRequested:       { category: 'reviews',    icon: 'building',         severity: 'warning' },
  UnitReviewRequested:           { category: 'reviews',    icon: 'home',             severity: 'warning' },
  MerchantRegistrationRequested: { category: 'reviews',    icon: 'user-plus',        severity: 'warning' },
  SupportTicketCreated:          { category: 'inquiries',  icon: 'headset',          severity: 'info' },
  ClientInquiryCreated:          { category: 'inquiries',  icon: 'message-question', severity: 'info' },
  ContactUsRequestCreated:       { category: 'inquiries',  icon: 'mail',             severity: 'info' },
  SubscriptionOrderCreated:      { category: 'finance',    icon: 'receipt',          severity: 'info' },
  SettlementFailed:              { category: 'finance',    icon: 'alert-triangle',   severity: 'error' },
  SettlementRequiresReview:      { category: 'finance',    icon: 'clipboard-check',  severity: 'warning' },
  PaymentIssueReported:          { category: 'finance',    icon: 'credit-card',      severity: 'error' },
  RefundRequested:               { category: 'finance',    icon: 'receipt-refund',   severity: 'warning' },
  // Severity isn't a backend field yet, so a SystemAlert is not assumed to be an error.
  SystemAlert:                   { category: 'system',     icon: 'alert-circle',     severity: 'neutral' },
};

const DEFAULT_PRESENTATION = { icon: 'bell', severity: 'neutral' as NotificationSeverity };

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'all', 'complaints', 'reviews', 'inquiries', 'finance', 'system',
];

export function categoryOf(type: string): NotificationCategory | null {
  return TYPE_PRESENTATION[type]?.category ?? null;
}

export function iconOf(type: string): string {
  return TYPE_PRESENTATION[type]?.icon ?? DEFAULT_PRESENTATION.icon;
}

export function severityOf(type: string): NotificationSeverity {
  return TYPE_PRESENTATION[type]?.severity ?? DEFAULT_PRESENTATION.severity;
}

export function isKnownType(type: string): boolean {
  return type in TYPE_PRESENTATION;
}

// Route segments relative to /:lang/d3. Reference types without a matching admin
// screen (SupportTicket, ClientInquiry, Payment) stay on the notifications page.
const REFERENCE_ROUTES: Record<string, (id: string) => string[]> = {
  Complaint:         id => ['complaints', id],
  Property:          id => ['build-review', id],
  Unit:              () => ['units'],
  Account:           id => ['account-management', 'review', id],
  ContactUsRequest:  () => ['contact-us'],
  SubscriptionOrder: () => ['subscriptions', 'requests'],
  Settlement:        () => ['settlements'],
  Booking:           () => ['bookings'],
};

export function routeFor(item: AdminNotification): string[] | null {
  if (!item.referenceId || !item.referenceType) return null;
  const build = REFERENCE_ROUTES[item.referenceType];
  return build ? build(item.referenceId) : null;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

// createdAt is offset-aware ISO-8601 — parse it as-is, never strip the offset.
export function relativeTime(iso: string, lang: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar' : 'en', { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.trunc(seconds / size), unit);
  }
  return rtf.format(0, 'minute');
}
