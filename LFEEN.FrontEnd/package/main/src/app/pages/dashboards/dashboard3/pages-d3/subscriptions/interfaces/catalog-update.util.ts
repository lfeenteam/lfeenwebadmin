import { SubscriptionCatalogItem, UpdateSubscriptionServiceRequest } from './subscription.model';
import { categoryKeyFromLabel } from './service-visual.util';

/**
 * Builds the body for PUT /catalog/{id}, which is a full replace: every field is sent, the
 * unchanged ones taken from the item as the GET returned it, then `changes` applied on top.
 * billingModel goes as null (= leave unchanged) unless a change sets it.
 */
export function buildCatalogUpdate(
  item: SubscriptionCatalogItem,
  changes: Partial<UpdateSubscriptionServiceRequest> = {},
): UpdateSubscriptionServiceRequest {
  return {
    nameAr: item.nameAr,
    nameEn: item.nameEn,
    descriptionAr: item.descriptionAr ?? null,
    descriptionEn: item.descriptionEn ?? null,
    // The catalog only returns the translated categoryLabel. Known labels (Arabic or English)
    // go back as their raw key; an unknown one is sent unchanged — never null, which could
    // wipe the category (a mismatch fails loudly with a 400 instead).
    category: item.categoryLabel ? (categoryKeyFromLabel(item.categoryLabel) ?? item.categoryLabel) : null,
    logoUrl: item.logoUrl ?? null,
    isAvailable: item.isAvailable,
    isActive: item.isActive,
    displayOrder: item.displayOrder,
    billingModel: null,
    billingStyle: item.billingModel === 'Paid' ? item.billingStyle ?? null : null,
    hasSetupFee: item.hasSetupFee ?? false,
    setupFeePrice: item.hasSetupFee ? item.setupFeePrice ?? null : null,
    hasTrial: item.hasTrial ?? false,
    trialDurationDays: item.hasTrial ? item.trialDurationDays ?? null : null,
    trialTransactionCount: item.hasTrial ? item.trialTransactionCount ?? null : null,
    ...changes,
  };
}
