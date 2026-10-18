export type EsimScope = 'Local' | 'Regional' | 'Global';
/** Use for the status badge; rawStatus is for support/debugging only. */
export type EsimStatusBucket = 'Active' | 'PendingActivation' | 'Suspended' | 'Expired';
export type EsimStateAction = 'suspend' | 'unsuspend' | 'revoke';

/** GET /api/esim/summary — the 4 KPI cards. */
export interface EsimSummary {
  totalEsims: number;
  newEsimsThisMonth: number;
  /** Active + Suspended (a suspended SIM is still in service). */
  activeEsims: number;
  /** activeEsims / totalEsims * 100, already rounded to 1 decimal. */
  activePercentage: number;
  totalUsers: number;
  newUsersThisMonth: number;
  totalSalesSar: number;
  /** Net sales this month minus last month, in SAR — can be negative. */
  salesDeltaVsLastMonthSar: number;
}

/** One physical eSIM (not one order). Text fields come back localized per Accept-Language. */
export interface EsimListItem {
  esimId: string;
  orderId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  destinationCode: string;
  destinationName: string;
  destinationType: EsimScope;
  destinationFlagUrl: string | null;
  networkType: string | null;
  /** Up to 3 carriers joined with " / ", e.g. "STC / Mobily". */
  operatorsSummary: string | null;
  /** The whole order's price — not split per eSIM when an order bundles several. */
  priceSar: number;
  packageName: string;
  totalVolumeBytes: number;
  totalVolumeText: string;
  totalDuration: number;
  durationUnit: string;
  dataPlanLabel: string;
  statusBucket: EsimStatusBucket;
  rawStatus: string;
  createdAtUtc: string;
  expiresAtUtc: string | null;
}

export interface EsimListResponse {
  items: EsimListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** Scope-tab counts: the other active filters applied, destinationType ignored. */
  globalCount: number;
  regionalCount: number;
  localCount: number;
}

export interface EsimListQuery {
  statusBucket?: EsimStatusBucket;
  destinationType?: EsimScope;
  destinationCode?: string;
  networkType?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export type EsimTimelineKey = 'purchased' | 'installed' | 'activated' | 'expires';

export interface EsimTimelineStep {
  key: EsimTimelineKey;
  /** null = not reached yet (only installed / activated). */
  atUtc: string | null;
}

/** GET /api/esim/esims/{esimId}. */
export interface EsimDetail {
  esimId: string;
  orderId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  /** All eSIMs this user owns, across every order. */
  userTotalEsims: number;
  iccid: string | null;
  esimTranNo: string;
  destinationCode: string;
  destinationName: string;
  destinationType: EsimScope;
  networkType: string | null;
  operatorsSummary: string | null;
  priceSar: number;
  packageName: string;
  totalVolumeBytes: number;
  totalVolumeText: string;
  usedVolumeBytes: number;
  usedVolumeText: string;
  /** 0–100, pre-computed. */
  usedPercent: number;
  dataPlanLabel: string;
  totalDuration: number;
  durationUnit: string;
  statusBucket: EsimStatusBucket;
  rawStatus: string;
  /** Always purchased, installed, activated, expires — in that order. */
  timeline: EsimTimelineStep[];
  createdAtUtc: string;
  installedAtUtc: string | null;
  activatedAtUtc: string | null;
  expiresAtUtc: string | null;
}

/**
 * POST /api/esim/esims/{esimId}/state — the thin live-provider shape. `id` is the esimId.
 * Re-fetch Detail / List afterwards rather than patching the UI from this.
 */
export interface EsimStateChangeResult {
  id: string;
  esimTranNo: string;
  iccid: string | null;
  esimStatus: string;
  smdpStatus: string;
  displayStatus: string;
  totalVolumeBytes: number;
  usedVolumeBytes: number;
  expiresAtUtc: string | null;
  topUpCount: number;
  needsSupportAttention: boolean;
}

/** Translation segment under d3.esim.status.* — also the badge's `status-*` class. */
export function esimStatusKey(bucket: EsimStatusBucket): string {
  switch (bucket) {
    case 'Active': return 'active';
    case 'PendingActivation': return 'pending';
    case 'Suspended': return 'suspended';
    default: return 'expired';
  }
}

/**
 * The API sends only the localized label, and per the guide it's exactly "غير محدود" /
 * "Unlimited" for unlimited plans — matched here just to pick the pill's colour.
 */
export function esimIsUnlimited(dataPlanLabel: string | null | undefined): boolean {
  const label = (dataPlanLabel ?? '').trim().toLowerCase();
  return label === 'unlimited' || label === 'غير محدود' || label === 'غير محدودة';
}

/** Translation key for totalDuration + durationUnit; Arabic uses the plural noun for 3–10. */
export function esimDurationKey(count: number, unit: string): string {
  const few = count >= 3 && count <= 10;
  switch ((unit ?? '').toUpperCase()) {
    case 'DAY': return few ? 'd3.esim.plan.daysFew' : 'd3.esim.plan.days';
    case 'MONTH': return few ? 'd3.esim.plan.monthsFew' : 'd3.esim.plan.months';
    default: return 'd3.esim.plan.other';
  }
}

/** Filter dialog selection; 'all' on a field means that field doesn't filter. */
export interface EsimFilters {
  status: EsimStatusBucket | 'all';
  /** A destinationCode, e.g. "SA". */
  destination: string;
  /** A network generation, e.g. "5G". */
  network: string;
}

export const EMPTY_ESIM_FILTERS: EsimFilters = { status: 'all', destination: 'all', network: 'all' };

/** Matched against the destination's best advertised network. */
export const ESIM_NETWORK_OPTIONS = ['5G', '4G', '3G'];

export interface EsimDestinationOption {
  code: string;
  name: string;
}
