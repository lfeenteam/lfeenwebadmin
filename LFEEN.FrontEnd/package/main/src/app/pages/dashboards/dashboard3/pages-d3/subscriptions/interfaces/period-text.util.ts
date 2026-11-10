/**
 * Display text for a subscription line's period. Free / built-in lines come back with
 * period "None" and an untranslated periodLabel "None" — those mean "no period", so they
 * yield an empty string and the caller shows nothing (or its own fallback). Lines priced before
 * the Package/Transaction redesign still carry the old enum as a bare number ("2", "3"), which
 * isn't a name either.
 */
export function periodText(periodLabel: string | null | undefined, period: string | null | undefined): string {
  const meaningful = (v: string) => !!v && v.toLowerCase() !== 'none' && !/^\d+$/.test(v);
  const label = periodLabel?.trim() ?? '';
  if (meaningful(label)) return label;
  const raw = period?.trim() ?? '';
  return meaningful(raw) ? raw : '';
}
