export type EsimScope = 'Local' | 'Regional' | 'Global';
export type EsimPlanType = 'Limited' | 'Unlimited';
export type EsimStatus = 'Active' | 'Pending' | 'Expired';

export interface EsimSubscription {
  id: string;
  userName: string;
  email: string;
  phone: string;
  purchasedAtUtc: string;
  /** Country or region the plan covers, e.g. "السعودية" / "أوروبا". */
  coverageName: string;
  /** Short code shown in the coverage badge, e.g. "SA" / "GCC". */
  coverageCode: string;
  scope: EsimScope;
  planType: EsimPlanType;
  networkType: string;
  carrier: string;
  dataGb: number;
  validityDays: number;
  price: number;
  status: EsimStatus;
  /** null until the SIM is activated. */
  activatedAtUtc: string | null;
  expiresAtUtc: string | null;
}

export interface EsimDetail extends EsimSubscription {
  simNumber: string;
  iccid: string;
  usedGb: number;
  /** How many SIMs this user owns in total. */
  simsCount: number;
}

// Arabic uses the plural noun for 3–10 and the singular for 11+.
export function esimValidityKey(days: number): string {
  return days >= 3 && days <= 10 ? 'd3.esim.plan.daysFew' : 'd3.esim.plan.days';
}

/** Filter dialog selection; 'all' on a field means that field doesn't filter. */
export interface EsimFilters {
  status: EsimStatus | 'all';
  /** A coverageName, e.g. "السعودية". */
  coverage: string;
  /** A network generation, e.g. "5G". */
  network: string;
}

export const EMPTY_ESIM_FILTERS: EsimFilters = { status: 'all', coverage: 'all', network: 'all' };

/** "4G / 5G" → ["4G", "5G"]. */
export function esimNetworkGenerations(networkType: string): string[] {
  return networkType.split('/').map(g => g.trim()).filter(Boolean);
}

export interface EsimSummary {
  totalSales: number;
  salesGrowthPercent: number;
  totalUsers: number;
  newUsers: number;
  activeSims: number;
  totalSims: number;
  newSimsThisMonth: number;
}

export interface EsimOverview {
  summary: EsimSummary;
  items: EsimSubscription[];
}
