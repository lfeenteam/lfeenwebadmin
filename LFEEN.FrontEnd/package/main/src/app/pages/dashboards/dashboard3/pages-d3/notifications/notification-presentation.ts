import {
  AdminNotification,
  NotificationCategory,
  NotificationSeverity,
} from '../../interfaces/admin-notification.model';
import { appLocale } from 'src/app/utils/locale-format.util';

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
  // A demo host asked for a real account (name, bookings, payments and interest in the text).
  DemoActivationRequested:       { category: 'reviews',    icon: 'user-star',        severity: 'warning' },
  // Someone signed up from a demo sign-up link; the text says when the sign-in data could not be sent.
  DemoSignupCompleted:           { category: 'reviews',    icon: 'link',             severity: 'info' },
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

/** Where a notification leads: route segments relative to /:lang/d3, plus optional query params. */
export interface NotificationDestination {
  commands: string[];
  queryParams?: Record<string, string>;
}

// Reference types without a matching admin screen (SupportTicket, ClientInquiry, Payment)
// stay on the notifications page.
const REFERENCE_ROUTES: Record<string, (id: string) => NotificationDestination> = {
  Complaint:         id => ({ commands: ['complaints', id] }),
  // Property and Unit notifications carry the GUID (externalId), but the review pages and
  // their section/decision endpoints work with the numeric id, so NotificationsComponent
  // resolves the GUID first (see REFERENCE_RESOLVED_TYPES). These lists are only the
  // fallback for when that lookup fails (e.g. the listing was deleted).
  Property:          () => ({ commands: ['buildings'] }),
  Unit:              () => ({ commands: ['units'], queryParams: { tab: 'pendingChanges' } }),
  Account:           id => ({ commands: ['account-management', 'review', id] }),
  // Opens the list with this request's details drawer open.
  ContactUsRequest:  id => ({ commands: ['contact-us'], queryParams: { id } }),
  SubscriptionOrder: () => ({ commands: ['subscriptions', 'requests'] }),
  Settlement:        () => ({ commands: ['settlements'] }),
  Booking:           () => ({ commands: ['bookings'] }),
  // Opens the activation-requests tab with this request open (no single-request endpoint).
  DemoActivationRequest: id => ({ commands: ['demo-accounts', 'activation-requests', id] }),
  // referenceId = the demo account's id (DemoSignupCompleted) — its page has resend / new PIN.
  DemoInvitation:        id => ({ commands: ['demo-accounts', id] }),
};

/** Reference types whose GUID must be looked up to reach the item itself. */
export const REFERENCE_RESOLVED_TYPES = new Set(['Property', 'Unit']);

export function routeFor(item: AdminNotification): NotificationDestination | null {
  if (!item.referenceId || !item.referenceType) return null;
  const build = REFERENCE_ROUTES[item.referenceType];
  return build ? build(item.referenceId) : null;
}

/**
 * Unit review page for a unit loaded by its GUID. A unit with nothing but its first
 * submission pending ('Pending') is a new unit; anything else under review is a change
 * request. The review page reads ?tab= for its header badge, like the unit lists pass it.
 */
export function unitReviewDestination(unit: { propertyId: number; unitId: number; overallStatus?: string | null }): NotificationDestination {
  const tab = unit.overallStatus?.trim() === 'Pending' ? 'new' : 'pendingChanges';
  return { commands: ['unit-review', String(unit.propertyId), String(unit.unitId)], queryParams: { tab } };
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
  const rtf = new Intl.RelativeTimeFormat(appLocale(lang === 'ar' ? 'ar' : 'en'), { numeric: 'auto' });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.trunc(seconds / size), unit);
  }
  return rtf.format(0, 'minute');
}
