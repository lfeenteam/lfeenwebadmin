export type OnboardingStatus = 'Draft' | 'PendingReview' | 'Approved' | 'Rejected';

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

export interface AccountStats {
  total: number;
  activeOrPublished: number;
  rejected: number;
  underReview: number;
}

export interface PaginatedAccountResponse {
  data: AccountItem[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
  stats: AccountStats;
}

export interface AccountDetail {
  accountId: string;
  referenceCode: string;
  onboardingStatus: OnboardingStatus;
  rejectionReason: string | null;
  businessType: string;
  createdAt: string;
  updatedAt: string | null;
  businessInfoStatus: string;
  bankInfoStatus: string;
  taxInfoStatus: string;
  documentsStatus: string;
  memberCount: number;
  propertyCount: number;
  business: {
    tradeName: string | null;
    tradeNameAr: string | null;
    tradeNameEn: string | null;
    legalEntityName: string | null;
    basicName: string | null;
    basicNameAr: string | null;
    basicNameEn: string | null;
    companyNumber: string | null;
    unifiedNationalNumber: string | null;
    unifiedNumberVerified: boolean;
    taxNumber: string | null;
    commercialExpiryDate: string | null;
    nationalCategory: string | null;
    businessCategory: string | null;
    businessSubcategory: string | null;
    logoFileId: string | null;
    logoUrl: string | null;
    trademarkDocumentFileId: string | null;
    trademarkDocumentUrl: string | null;
  } | null;
  contact: {
    phoneNumber: string | null;
    countryCode: string | null;
    phoneVerified: boolean;
    email: string | null;
    city: string | null;
    district: string | null;
    region: string | null;
    postalCode: string | null;
    shortNationalAddress: string | null;
    buildingNumber: string | null;
    streetName: string | null;
  } | null;
  bank: {
    iban: string | null;
    beneficiaryName: string | null;
    bankName: string | null;
    swiftCode: string | null;
  } | null;
  tax: {
    hasVatCertificate: boolean | null;
    vatNumber: string | null;
  } | null;
  documents: any[];
}

export interface Account {
  id: string;
  name: string;
  type: 'individual' | 'company';
  status: 'active' | 'suspended' | 'under_review' | 'rejected' | 'draft';
  onboardingStatus: OnboardingStatus;
  idNumber: string;
  joinDate: string;
  propertyCount: number;
  unit: string;
  avatarInitials?: string;
  paymentBadge?: string;
  tradeName?: string;
  logoUrl?: string | null;
}
