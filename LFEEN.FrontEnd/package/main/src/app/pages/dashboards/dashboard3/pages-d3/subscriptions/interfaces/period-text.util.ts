/**
 * Display text for a subscription line's period. Free / built-in lines come back with
 * period "None" and an untranslated periodLabel "None" — those mean "no period", so they
 * yield an empty string and the caller shows nothing (or its own fallback).
 */
export function periodText(periodLabel: string | null | undefined, period: string | null | undefined): string {
  const label = periodLabel?.trim() ?? '';
  if (label && label.toLowerCase() !== 'none') return label;
  const raw = period?.trim() ?? '';
  return raw.toLowerCase() === 'none' ? '' : raw;
}
