import { parseApiUtc } from 'src/app/utils/date-format.util';
import { DiscountCodeState, SubscriptionDiscountCode } from '../interfaces/subscription.model';

/** discountType has no label field and its raw values aren't confirmed yet — anything that isn't a percentage reads as a fixed amount. */
export function isPercentageDiscount(type: string | null | undefined): boolean {
  return /percent/i.test(type ?? '');
}

/** Display state, checked in the order the backend guide specifies. */
export function discountCodeState(code: SubscriptionDiscountCode, now = new Date()): DiscountCodeState {
  if (!code.isActive) return 'disabled';
  const validTo = parseApiUtc(code.validTo);
  if (validTo && validTo < now) return 'expired';
  const validFrom = parseApiUtc(code.validFrom);
  if (validFrom && validFrom > now) return 'scheduled';
  if (code.maxRedemptions != null && code.redemptionCount >= code.maxRedemptions) return 'exhausted';
  return 'active';
}
