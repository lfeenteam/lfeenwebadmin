export interface MetricComparison {
  value: number;
  previousValue: number;
  changePercentage: number | null;
}

export interface RateComparison {
  value: number;
  previousValue: number;
  changePercentagePoints: number;
}

export interface UnavailableMetric {
  value: number | null;
  availability: 'notConfigured' | string;
  requiredSource: string;
}

export interface DashboardSummary {
  asOfUtc: string;
  currency: 'SAR' | string;
  period: {
    fromUtc: string;
    toUtc: string;
    comparisonFromUtc: string;
    comparisonToUtc: string;
    timeZone: string;
  };
  // Permission-scoped groups (TAS-2508): the server leaves out (or sends null for) every
  // group — or platform metric — the admin may not see. Never read a missing one as zero;
  // the widgets it feeds are hidden (see withheldWidgets in services/dashboard-widgets.ts).
  platform?: {
    revenue?: MetricComparison | null;
    completedBookings?: MetricComparison | null;
    averageBookingValue?: MetricComparison | null;
    cancellationRate?: RateComparison | null;
  } | null;
  guestApp?: {
    registeredGuests: number;
    returningGuestRate: number;
    averageAppRating: number | null;
    openComplaints: number;
    /** Share of guests whose gender is known (identity-verified), not of all guests. */
    malePercentage: number;
    femalePercentage: number;
    /** Guests whose gender is unknown (not identity-verified). Optional until every backend ships it. */
    unknownGenderCount?: number;
    /** unknownGenderCount as a share of all registered guests. */
    unknownGenderPercentage?: number;
    downloads: UnavailableMetric;
  } | null;
  merchantApp?: {
    activeMerchants: number;
    listedUnits: number;
    occupancyRate: number;
    merchantRetentionRate: number;
    openComplaints: number;
    averageAppRating: UnavailableMetric;
  } | null;
  /** Missing/null = withheld; an empty array is real data (no revenue in the period). */
  revenueSources?: Array<{
    key: 'bookingCommissions' | 'subscriptions' | 'usageServices' | string;
    amount: number;
    percentage: number;
  }> | null;
  dataQuality: Array<{ code: string; message: string }>;
}

export interface DashboardGrowth {
  asOfUtc: string;
  period: { fromUtc: string; toUtc: string; timeZone: string };
  granularity: 'daily' | 'weekly' | 'monthly';
  totals: { newGuests: number; newMerchants: number; bookings: number };
  points: Array<{
    startUtc: string;
    endUtc: string;
    label: string;
    newGuests: number;
    newMerchants: number;
    bookings: number;
  }>;
}

export interface DashboardTopCities {
  asOfUtc: string;
  period: { fromUtc: string; toUtc: string; timeZone: string };
  totalBookings: number;
  mappedBookings: number;
  unmappedBookings: number;
  cities: Array<{
    rank: number;
    city: string;
    cityAr: string;
    cityEn: string;
    bookings: number;
    units: number;
    percentage: number;
  }>;
}

export type InsightSeverity = 'critical' | 'warning' | 'opportunity' | 'info';

export interface DashboardInsight {
  key: string;
  category: 'finance' | 'operations' | 'bookings' | 'support' | 'growth' | string;
  severity: InsightSeverity;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  value: number;
  unit: 'count' | 'percentage' | string;
  actionPath: string | null;
}

export interface DashboardInsights {
  generatedAtUtc: string;
  insights: DashboardInsight[];
}

export interface DashboardFilters {
  from?: string;
  to?: string;
  timeZone?: string;
}
