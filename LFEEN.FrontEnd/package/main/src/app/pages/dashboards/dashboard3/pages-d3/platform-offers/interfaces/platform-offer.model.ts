export type OfferTriggerType = 'Automatic' | 'Coupon';
export type OfferDiscountType = 'Percentage' | 'FixedAmount' | 'FinalPrice';
export type OfferAppliedTo = 'AllUnits' | 'SpecificUnits';
export type OfferDisplayChannel = 'All' | 'Merchant' | 'Client';

const DISPLAY_CHANNELS: readonly OfferDisplayChannel[] = ['All', 'Merchant', 'Client'];
/** Backend enum order (All=1, Merchant=2, Client=3) — API builds before the DTO fix
 * serialize displayChannel as that number ("1") instead of the enum name. */
const DISPLAY_CHANNEL_BY_NUMBER: Record<string, OfferDisplayChannel> = { '1': 'All', '2': 'Merchant', '3': 'Client' };

/** The channel name for either API shape, or null when the value is unknown/empty. */
export function normalizeDisplayChannel(value: unknown): OfferDisplayChannel | null {
  if (value === null || value === undefined) return null;
  const v = String(value).trim();
  const byName = DISPLAY_CHANNELS.find(c => c.toLowerCase() === v.toLowerCase());
  return byName ?? DISPLAY_CHANNEL_BY_NUMBER[v] ?? null;
}
export type OfferExpirationPolicy =
  'ByDate' | 'ByUsageLimit' | 'WhicheverFirst';

export interface PlatformOfferListItem {
  id: number;
  externalId: string;
  internalNameAr: string;
  internalNameEn: string;
  externalNameAr?: string | null;
  externalNameEn?: string | null;
  banner?: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  code?: string | null;
  triggerType: OfferTriggerType;
  discountType: OfferDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  offerStartDate?: string | null;
  offerEndDate?: string | null;
  isActive: boolean;
  isExpired: boolean;
  statusAr: string;
  statusEn: string;
  totalRedemptions: number;
}
export interface OfferUnit {
  unitId: number;
  unitExternalId?: string;
  unitTitleAr?: string;
  unitTitleEn?: string;
}
export interface ExclusionPeriod {
  id?: number;
  startDate: string;
  endDate: string;
  reason?: string | null;
}
export interface CustomMessage {
  id?: number;
  type: string;
  messageAr: string;
  messageEn: string;
}
export interface OfferTerm {
  id?: number;
  termAr: string;
  termEn: string;
  order: number;
}
export interface PlatformOfferDetail extends PlatformOfferListItem {
  appliedTo: OfferAppliedTo;
  offerDaysOfWeek?: string | null;
  happyHourStart?: string | null;
  happyHourEnd?: string | null;
  stayStartDate?: string | null;
  stayEndDate?: string | null;
  stayDaysOfWeek?: string | null;
  maxTotalUsage?: number | null;
  maxDailyUsage?: number | null;
  maxDailyUsagePerUser?: number | null;
  maxTotalUsagePerUser?: number | null;
  minDaysBeforeArrival?: number | null;
  minStayDays?: number | null;
  maxStayDays?: number | null;
  allowedPaymentMethods?: string | null;
  minBookingAmount?: number | null;
  displayChannel: OfferDisplayChannel;
  canBeCombined: boolean;
  expirationPolicy: OfferExpirationPolicy;
  loyaltyPointsMultiplier: number;
  offerUnits: OfferUnit[];
  exclusionPeriods: ExclusionPeriod[];
  customMessages: CustomMessage[];
  offerTerms: OfferTerm[];
}
export interface PlatformOfferListResponse {
  data: PlatformOfferListItem[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
}
export interface PlatformOfferStatistics {
  totalRedemptions: number;
  dailyRedemptions: number;
  remainingUsage: number | null;
  totalSalesAmount: number;
  uniqueCustomersCount: number;
  totalUnitsCount: number;
  totalDiscountAmount: number;
  currentMonthRedemptions: number;
  previousMonthRedemptions: number;
  growthPercentage: number | null;
  dominantPaymentMethod: string | null;
  topUnits: unknown[];
  redemptionsByDay: unknown[];
}
export interface OfferListParams {
  search?: string;
  triggerType?: OfferTriggerType;
  offerStatus?: string;
  minDiscount?: number;
  maxDiscount?: number;
  startDateFrom?: string;
  startDateTo?: string;
  pageNumber: number;
  pageSize: number;
}
export interface OfferFormValue {
  [key: string]: unknown;
  exclusionPeriods: ExclusionPeriod[];
  customMessages: CustomMessage[];
  offerTerms: OfferTerm[];
  unitIds: number[];
}
