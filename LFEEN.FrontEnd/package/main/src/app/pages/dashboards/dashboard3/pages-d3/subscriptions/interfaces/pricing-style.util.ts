import { SubscriptionCatalogItem, SubscriptionPricingItem } from './subscription.model';

/**
 * Which pricing section a service shows, and which endpoint prices it:
 *   Package     = period options (GET/POST/PUT /period-options)
 *   Transaction = one per-operation rate (POST /pricing, period "None")
 *   MessagePack = one pack price + messages per pack (POST /pricing, period "MessagePack")
 *   none        = Free / BuiltIn — no pricing at all
 */
export type PricingStyle = 'Package' | 'Transaction' | 'MessagePack' | 'none';

// `id` differs per server, so services are matched by their fixed `key`.
const MESSAGE_PACK_KEYS = ['smsGateway'];

/**
 * The admin picks Package or Transaction on the service. MessagePack isn't a billing style of
 * its own, so a service is treated as one when it already has a MessagePack price, or is the
 * SMS gateway.
 */
export function pricingStyleOf(
  item: Pick<SubscriptionCatalogItem, 'key' | 'billingModel' | 'billingStyle'> | null | undefined,
  pricing: SubscriptionPricingItem[] = [],
): PricingStyle {
  if (!item || item.billingModel !== 'Paid') return 'none';
  if (MESSAGE_PACK_KEYS.includes(item.key) || pricing.some(p => p.period === 'MessagePack')) return 'MessagePack';
  return item.billingStyle === 'Transaction' ? 'Transaction' : 'Package';
}
