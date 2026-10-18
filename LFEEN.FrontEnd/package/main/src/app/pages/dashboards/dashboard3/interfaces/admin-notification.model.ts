export type AdminNotificationType =
  | 'ComplaintCreated'
  | 'PropertyReviewRequested'
  | 'UnitReviewRequested'
  | 'MerchantRegistrationRequested'
  | 'SupportTicketCreated'
  | 'ClientInquiryCreated'
  | 'ContactUsRequestCreated'
  | 'SubscriptionOrderCreated'
  | 'SettlementFailed'
  | 'SettlementRequiresReview'
  | 'PaymentIssueReported'
  | 'RefundRequested'
  | 'BookingIssueReported'
  | 'SystemAlert';

export interface AdminNotification {
  id: string;
  // Plain string too — the backend may add types before the frontend knows them.
  type: AdminNotificationType | string;
  title: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  referenceId: string | null;
  referenceType: string | null;
}

export interface AdminNotificationList {
  items: AdminNotification[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// SignalR payload carries both languages because the hub connection outlives a language switch.
export interface AdminNotificationRealtimeEvent {
  id: string;
  type: AdminNotificationType | string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  isRead: boolean;
  createdAt: string;
  referenceId: string | null;
  referenceType: string | null;
  unreadCount: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface NotificationActionResponse {
  success: boolean;
  message: string;
}

export interface AdminNotificationQuery {
  page?: number;
  pageSize?: number;
  isRead?: boolean | null;
  type?: string | null;
}

export type NotificationCategory = 'all' | 'complaints' | 'reviews' | 'inquiries' | 'finance' | 'system';
export type NotificationSeverity = 'error' | 'warning' | 'info' | 'neutral';
