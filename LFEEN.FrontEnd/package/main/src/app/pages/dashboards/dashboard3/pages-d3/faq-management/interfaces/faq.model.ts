export type FaqDepartment = 'General' | 'Booking' | 'Payment' | 'Technical' | 'Account';
export type FaqStatus = 'active' | 'inactive';

export interface FaqArticle {
  id: number;
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

// Matches POST /api/support-faq exactly (PascalCase field names as required by the API).
export interface CreateFaqArticleRequest {
  TitleEn: string;
  TitleAr: string;
  BodyEn: string;
  BodyAr: string;
  Department: FaqDepartment | null;
  DisplayOrder: number;
}

// PUT /api/support-faq/{externalId} is a full replace — every field must be sent,
// including IsActive. Prefer POST /api/support-faq/{externalId} (activate) or
// POST /api/support-faq/{externalId}/deactivate for a plain status toggle.
export interface UpdateFaqArticleRequest extends CreateFaqArticleRequest {
  IsActive: boolean;
}

// Matches the shape returned by both GET /api/support-faq and POST /api/support-faq.
export interface FaqArticleDto {
  id: number;
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
