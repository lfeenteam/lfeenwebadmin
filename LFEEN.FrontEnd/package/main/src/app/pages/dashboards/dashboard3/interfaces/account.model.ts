export type OnboardingStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected';

export interface AccountItem {
  accountId: string;
  referenceCode: string;
  tradeName: string;
  tradeNameAr: string;
  tradeNameEn: string;
  companyNumber: string | null;
  onboardingStatus: OnboardingStatus;
  rejectionReason: string | null;
  createdAt: string;
  propertyCount: number;
  businessType: string;
  logoFileId: string | null;
  logoUrl: string | null;
}

export interface PaginatedAccountResponse {
  data: AccountItem[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
}

export interface Account {
  id: string;
  name: string;
  type: 'individual' | 'company';
  status: 'active' | 'suspended' | 'under_review' | 'rejected';
  onboardingStatus: OnboardingStatus;
  idNumber: string;
  joinDate: string;
  propertyCount: number;
  unit: string;
  avatarInitials?: string;
  paymentBadge?: string;
  tradeName?: string;
}
