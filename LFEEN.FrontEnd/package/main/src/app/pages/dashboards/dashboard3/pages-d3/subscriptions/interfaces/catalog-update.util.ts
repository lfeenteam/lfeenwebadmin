import { SubscriptionCatalogItem, UpdateSubscriptionServiceRequest } from './subscription.model';
import { categoryKeyFromLabel } from './service-visual.util';

/**
 * Builds the body for PUT /catalog/{id}, which is a full replace: anything left out is reset
 * server-side. Everything the GET returned is sent back (including fields this app doesn't
 * model yet), minus the immutable/computed ones, then `changes` is applied on top.
 */
export function buildCatalogUpdate(
  item: SubscriptionCatalogItem,
  changes: Partial<UpdateSubscriptionServiceRequest> = {},
): UpdateSubscriptionServiceRequest {
  // id/key are immutable; the rest of this list is read-only data computed by the backend.
  const { id, key, categoryLabel, features, monthlyPrice, yearlyPrice, currencyCode, trialDays, ...editable } = item;

  return {
    ...editable,
    // The catalog only returns the translated categoryLabel. Known labels (Arabic or English)
    // go back as their raw key; an unknown one is sent unchanged — never null, which could
    // wipe the category (a mismatch fails loudly with a 400 instead).
    category: categoryLabel ? (categoryKeyFromLabel(categoryLabel) ?? categoryLabel) : null,
    ...changes,
  };
}
