// Service (worker) app FAQ — /api/service/faqs (BUG-2453).
// Success responses are NOT wrapped: GET returns a bare array, POST/PUT/PATCH return the
// DTO itself and DELETE returns true. Only errors come as { success, message, errorCode }.

export type ServiceFaqCategory = 'Tasks' | 'Locks' | 'Photos' | 'Account';

export interface ServiceFaqCategoryOption {
  value: ServiceFaqCategory;
  labelKey: string;
}

export const SERVICE_FAQ_CATEGORY_OPTIONS: ServiceFaqCategoryOption[] = [
  { value: 'Tasks',   labelKey: 'd3.serviceFaq.category.Tasks' },
  { value: 'Locks',   labelKey: 'd3.serviceFaq.category.Locks' },
  { value: 'Photos',  labelKey: 'd3.serviceFaq.category.Photos' },
  { value: 'Account', labelKey: 'd3.serviceFaq.category.Account' },
];

export interface ServiceFaqDto {
  id: string;
  key: string;
  category: ServiceFaqCategory;
  categoryName: string;
  questionAr: string;
  questionEn: string;
  answerAr: string;
  answerEn: string;
  displayOrder: number;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

/** POST and PUT body. `key` optional: blank on create → server generates it;
 * omitted on update → kept as is. */
export interface SaveServiceFaqRequest {
  key?: string;
  category: ServiceFaqCategory;
  questionAr: string;
  questionEn: string;
  answerAr: string;
  answerEn: string;
  displayOrder: number;
  isActive: boolean;
}

export interface GetServiceFaqsParams {
  includeInactive?: boolean;
  category?: ServiceFaqCategory;
  search?: string;
}

// Same limits as the server validator; the server still validates, these only fail fast.
export const SERVICE_FAQ_KEY_MAX_LENGTH = 100;
export const SERVICE_FAQ_KEY_PATTERN = /^[A-Za-z0-9_-]*$/;
export const SERVICE_FAQ_QUESTION_MAX_LENGTH = 500;
export const SERVICE_FAQ_ANSWER_MAX_LENGTH = 4000;
// displayOrder is an int on the server; this cap keeps it inside int range.
export const SERVICE_FAQ_ORDER_MAX = 9999;

export const SERVICE_FAQ_ERROR_CODES = {
  validation: 'VALIDATION_ERROR',
  keyExists: 'STAFF_FAQ_KEY_EXISTS',
  notFound: 'STAFF_FAQ_NOT_FOUND',
} as const;
