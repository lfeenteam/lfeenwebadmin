import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Limits shared with the backend validator (CreatePlatformOfferCommand). */
export const OFFER_LIMITS = {
  nameMax: 100,
  descriptionMax: 1000,
  codeMax: 50,
  percentMax: 100,
  amountMax: 1_000_000,
  maxYearsAhead: 2,
  // Day/usage/order fields are int on the server; values past int range fail model binding.
  stayDaysMax: 365,
  arrivalDaysMax: 730,
  usageMax: 1_000_000,
  orderMax: 9999,
} as const;

export const OFFER_DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const CODE_RE = /^[A-Za-z0-9_-]+$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const empty = (v: unknown) => v === null || v === undefined || v === '';

/** Parses the form's local "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" strings. */
export function parseLocal(v: unknown): Date | null {
  if (empty(v)) return null;
  const s = String(v);
  const d = new Date(s.length === 10 ? `${s}T00:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const offerCodeValidator: ValidatorFn = (c) =>
  empty(c.value) || CODE_RE.test(String(c.value))
    ? null
    : { codePattern: true };

export const timeValidator: ValidatorFn = (c) =>
  empty(c.value) || TIME_RE.test(String(c.value)) ? null : { time: true };

/** Comma separated list of known day names, e.g. "Sat,Sun". */
export const daysOfWeekValidator: ValidatorFn = (c) => {
  if (empty(c.value)) return null;
  const parts = String(c.value).split(',').map((p) => p.trim());
  const known = OFFER_DAYS.map((d) => d.toLowerCase());
  return parts.every((p) => known.includes(p.toLowerCase()))
    ? null
    : { days: true };
};

/** Max depends on the discount type: 100 for a percentage, 1,000,000 otherwise. */
export const discountValueMaxValidator: ValidatorFn = (c) => {
  const type = c.parent?.get('discountType')?.value;
  const v = Number(c.value);
  if (empty(c.value) || Number.isNaN(v)) return null;
  const max =
    type === 'Percentage' ? OFFER_LIMITS.percentMax : OFFER_LIMITS.amountMax;
  return v > max ? { maxValue: { max } } : null;
};

/**
 * Cross-field rules for the whole offer form. Errors are returned as
 * `{ fields: { <controlName>: <errorKey> } }` so the template can show each
 * one under the field it belongs to.
 */
export function offerFormValidator(isCreate: () => boolean): ValidatorFn {
  return (g: AbstractControl): ValidationErrors | null => {
    const v = g.value;
    const fields: Record<string, string> = {};
    const num = (x: unknown) => (empty(x) ? null : Number(x));

    const start = parseLocal(v.offerStartDate);
    const end = parseLocal(v.offerEndDate);
    const now = new Date();
    const maxDate = new Date(now);
    maxDate.setFullYear(maxDate.getFullYear() + OFFER_LIMITS.maxYearsAhead);
    if (start && end && end <= start) fields['offerEndDate'] = 'endBeforeStart';
    else if (end && isCreate() && end < now) fields['offerEndDate'] = 'endInPast';
    else if (end && end > maxDate) fields['offerEndDate'] = 'tooFar';
    if (start && start > maxDate) fields['offerStartDate'] = 'tooFar';

    const stayStart = parseLocal(v.stayStartDate);
    const stayEnd = parseLocal(v.stayEndDate);
    if (stayStart && stayEnd && stayEnd <= stayStart)
      fields['stayEndDate'] = 'endBeforeStart';

    const minStay = num(v.minStayDays);
    const maxStay = num(v.maxStayDays);
    if (minStay !== null && maxStay !== null && minStay > maxStay)
      fields['maxStayDays'] = 'minGtMax';

    const total = num(v.maxTotalUsage);
    const daily = num(v.maxDailyUsage);
    if (total !== null && daily !== null && daily > total)
      fields['maxDailyUsage'] = 'dailyGtTotal';

    const userTotal = num(v.maxTotalUsagePerUser);
    const userDaily = num(v.maxDailyUsagePerUser);
    if (userTotal !== null && userDaily !== null && userDaily > userTotal)
      fields['maxDailyUsagePerUser'] = 'dailyGtTotal';
    if (userTotal !== null && total !== null && userTotal > total)
      fields['maxTotalUsagePerUser'] = 'userGtTotal';

    if (
      v.appliedTo === 'SpecificUnits' &&
      !(Array.isArray(v.unitIds) && v.unitIds.length)
    )
      fields['unitIds'] = 'unitsRequired';

    return Object.keys(fields).length ? { fields } : null;
  };
}

/** Exclusion row: end after start, and inside the offer period when it is set. */
export const exclusionRowValidator: ValidatorFn = (row) => {
  const s = parseLocal(row.get('startDate')?.value);
  const e = parseLocal(row.get('endDate')?.value);
  if (!s || !e) return null;
  if (e <= s) return { exclusionRange: true };
  const form = row.parent?.parent;
  const offerStart = parseLocal(form?.get('offerStartDate')?.value);
  const offerEnd = parseLocal(form?.get('offerEndDate')?.value);
  if ((offerStart && s < offerStart) || (offerEnd && e > offerEnd))
    return { exclusionOutside: true };
  return null;
};
