/**
 * Tailwind class groups for the KPI cards and app tiles (tw- prefix, tailwind.config.js).
 * Kept as full literal strings — Tailwind only generates classes it can read in the source,
 * so never build these from pieces at runtime.
 *
 * Design values = the LFEEN host dashboard: 18px cards on a #EEF2F7 hairline, a tinted
 * semi-3D icon tile in the metric colour (`tw-tone-*` sets --tone / --tone-soft /
 * --tone-shadow), hover lift 2px over 260ms on the soft ease-out, icons moving over 420ms,
 * cards rising in over 600ms. Hover effects only with a real pointer (`can-hover:`).
 */

const ICON_TILE =
  'tw-grid tw-place-items-center tw-shrink-0 tw-bg-tone-soft tw-bg-icon-light tw-shadow-icon tw-text-tone ' +
  'tw-[--d3-icon-fill:.18] tw-transition tw-duration-hover tw-ease-soft';

export const CARD_STYLES = {
  sectionTitle: 'tw-m-0 tw-text-xl tw-font-extrabold tw-leading-snug tw-text-ink',
  sectionSub: 'tw-mt-0.5 tw-mb-0 tw-text-xs tw-font-semibold tw-text-faint',

  kpiCard:
    'tw-group/kpi tw-relative tw-flex tw-flex-col tw-gap-4 tw-min-w-0 tw-p-5 tw-bg-white ' +
    'tw-border tw-border-solid tw-border-line tw-rounded-card tw-shadow-card tw-text-inherit tw-no-underline ' +
    'tw-animate-enter tw-transition-[transform,box-shadow,border-color] tw-duration-hover tw-ease-soft ' +
    'can-hover:hover:-tw-translate-y-0.5 can-hover:hover:tw-border-line-strong can-hover:hover:tw-shadow-card-hover ' +
    'focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ink/25 ' +
    'motion-reduce:tw-animate-none motion-reduce:tw-transition-none',

  panel:
    'tw-min-w-0 tw-p-6 tw-bg-white tw-border tw-border-solid tw-border-line tw-rounded-card tw-shadow-card ' +
    'tw-animate-enter motion-reduce:tw-animate-none',

  iconTileLg:
    ICON_TILE + ' tw-w-12 tw-h-12 tw-rounded-icon tw-[--d3-icon-size:24px] ' +
    'can-hover:group-hover/kpi:-tw-translate-y-px can-hover:group-hover/kpi:tw-shadow-icon-hover',
  iconTileMd: ICON_TILE + ' tw-w-10 tw-h-10 tw-rounded-xl tw-[--d3-icon-size:20px]',
  iconTileSm: ICON_TILE + ' tw-w-[38px] tw-h-[38px] tw-rounded-icon-sm tw-[--d3-icon-size:20px]',

  // "View list": the arrow only on a laptop-width card, the label too on wide screens.
  pill:
    'tw-shrink-0 tw-inline-flex tw-items-center tw-gap-1 tw-h-[26px] tw-px-1.5 min-[1800px]:tw-ps-2.5 ' +
    'tw-rounded-full tw-bg-tile tw-text-muted tw-text-[11.5px] tw-font-bold tw-whitespace-nowrap ' +
    'tw-[--d3-icon-size:14px] tw-transition-colors tw-duration-hover ' +
    'can-hover:group-hover/kpi:tw-bg-ink can-hover:group-hover/kpi:tw-text-white',

  trendChip:
    'tw-inline-flex tw-items-center tw-gap-[3px] tw-px-2 tw-py-0.5 tw-rounded-full ' +
    'tw-text-xs tw-font-extrabold tw-leading-normal tw-[--d3-icon-size:13px]',

  tile:
    'tw-group/tile tw-relative tw-flex tw-items-center tw-gap-3 tw-min-w-0 tw-min-h-[74px] tw-p-3.5 ' +
    'tw-rounded-tile tw-bg-tile tw-border tw-border-solid tw-border-transparent tw-text-inherit tw-no-underline ' +
    'tw-transition-[transform,box-shadow,border-color,background-color] tw-duration-hover tw-ease-soft ' +
    'can-hover:hover:tw-bg-white can-hover:hover:tw-border-line-strong can-hover:hover:tw-shadow-tile-hover ' +
    'can-hover:hover:-tw-translate-y-0.5 motion-reduce:tw-transition-none ' +
    'focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ink/25',

  tileGo:
    'tw-shrink-0 tw-text-faint tw-[--d3-icon-size:16px] tw-transition tw-duration-icon tw-ease-soft ' +
    'can-hover:group-hover/tile:tw-text-ink rtl:can-hover:group-hover/tile:-tw-translate-x-0.5 ' +
    'ltr:can-hover:group-hover/tile:tw-translate-x-0.5',
} as const;

export const TONE_CLASS = {
  navy: 'tw-tone-navy',
  green: 'tw-tone-green',
  blue: 'tw-tone-blue',
  red: 'tw-tone-red',
  amber: 'tw-tone-amber',
  violet: 'tw-tone-violet',
} as const;

/** KPI grid columns by how many KPIs this admin may see (no hole for a hidden one). */
export const KPI_GRID_CLASS: Record<number, string> = {
  4: 'tw-grid-cols-4 max-[1279px]:tw-grid-cols-2 max-[575px]:tw-grid-cols-1',
  3: 'tw-grid-cols-3 max-[1279px]:tw-grid-cols-2 max-[1279px]:[&>:first-child]:tw-col-span-2 max-[575px]:tw-grid-cols-1 max-[575px]:[&>:first-child]:tw-col-span-1',
  2: 'tw-grid-cols-2 max-[575px]:tw-grid-cols-1',
  1: 'tw-grid-cols-[minmax(0,420px)] max-[575px]:tw-grid-cols-1',
};

/** App tile columns (2 beside the other panel, up to 4 when alone); narrow screens auto-fit. */
export const TILE_GRID_CLASS: Record<number, string> = {
  1: 'tw-grid-cols-1',
  2: 'tw-grid-cols-2 max-md:tw-grid-cols-[repeat(auto-fit,minmax(170px,1fr))] max-[400px]:tw-grid-cols-1',
  3: 'tw-grid-cols-3 max-md:tw-grid-cols-[repeat(auto-fit,minmax(170px,1fr))] max-[400px]:tw-grid-cols-1',
  4: 'tw-grid-cols-4 max-md:tw-grid-cols-[repeat(auto-fit,minmax(170px,1fr))] max-[400px]:tw-grid-cols-1',
};

export const TREND_CHIP_CLASS = {
  up: 'tw-bg-[#ECFDF5] tw-text-[#059669]',
  warn: 'tw-bg-[#FEF2F2] tw-text-[#DC2626]',
  flat: 'tw-bg-divider tw-text-body',
} as const;
