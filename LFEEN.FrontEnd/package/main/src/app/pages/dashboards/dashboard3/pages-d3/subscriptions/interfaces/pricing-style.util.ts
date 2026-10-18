import { SubscriptionPricingItem } from './subscription.model';

/**
 * Which pricing section the service settings page shows:
 *   Subscription = tiers × Monthly/Yearly rows, setup/usage fees, trial, seasonal prices
 *   MessagePack  = one pack price + messages per pack (a prepaid balance with no expiry)
 * Usage-only services are priced through Subscription rows (price 0 + a usage fee).
 */
export type PricingStyle = 'Subscription' | 'MessagePack';

// `id` differs per server, so services are matched by their fixed `key`.
const MESSAGE_PACK_KEYS = ['smsGateway'];

/**
 * The catalog's own `pricingStyle` wins once the backend sends it. Until then it's derived
 * from the service key, then from whether any of its pricing rows is a MessagePack.
 */
export function pricingStyleOf(
  key: string | null | undefined,
  pricing: SubscriptionPricingItem[] = [],
  declared?: string | null,
): PricingStyle {
  const style = declared?.trim().toLowerCase();
  if (style === 'messagepack') return 'MessagePack';
  if (style === 'subscription' || style === 'usage') return 'Subscription';
  if (key && MESSAGE_PACK_KEYS.includes(key)) return 'MessagePack';
  return pricing.some(p => p.period === 'MessagePack') ? 'MessagePack' : 'Subscription';
}
