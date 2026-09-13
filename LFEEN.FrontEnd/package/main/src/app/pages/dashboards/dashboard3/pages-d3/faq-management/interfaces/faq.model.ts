// Departments are free text in the Client FAQ API; these UI options are suggestions.
export type FaqDepartment = string;
export type FaqStatus = 'active' | 'inactive';

export interface FaqArticle {
  externalId: string;
  order: number;
  titleEn: string;
  titleAr: string;
  contentEn: string;
  contentAr: string;
  department: FaqDepartment | null;
  status: FaqStatus;
}

export interface FaqDepartmentOption {
  value: FaqDepartment;
  labelEn: string;
  labelAr: string;
}

export const FAQ_DEPARTMENT_OPTIONS: FaqDepartmentOption[] = [
  { value: 'General',   labelEn: 'General',   labelAr: 'عام' },
  { value: 'Booking',   labelEn: 'Booking',   labelAr: 'الحجوزات' },
  { value: 'Payment',   labelEn: 'Payment',   labelAr: 'الدفع' },
  { value: 'Technical', labelEn: 'Technical', labelAr: 'تقني' },
  { value: 'Account',   labelEn: 'Account',   labelAr: 'الحساب' },
];

// POST and PUT /api/client-faq use the same editable-field payload.
export interface CreateFaqArticleRequest {
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  department: FaqDepartment | null;
  displayOrder: number;
}

// Active state is changed only through the activate/deactivate endpoints.
export type UpdateFaqArticleRequest = CreateFaqArticleRequest;

// Matches the article returned by the Client FAQ endpoints.
export interface FaqArticleDto {
  externalId: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  department: FaqDepartment | null;
  displayOrder: number;
  isActive: boolean;
}

export interface GetFaqArticlesParams {
  department?: FaqDepartment;
  activeOnly?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

// GET /api/client-faq returns a paginated envelope, not a bare array.
export interface PaginatedFaqArticlesResponse {
  data: FaqArticleDto[];
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  page: number;
  nextPage: number | null;
  totalPages: number;
}
