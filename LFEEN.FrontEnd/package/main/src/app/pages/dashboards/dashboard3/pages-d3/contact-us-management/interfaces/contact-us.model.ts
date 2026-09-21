export type ContactUsStatus = 'New' | 'Viewed' | 'Closed';

export interface ContactUsListItem {
  externalId: string;
  name: string;
  phone: string;
  email: string;
  subject: string;
  status: ContactUsStatus;
  closingNote: string | null;
  attachmentsCount: number;
  createdAt: string;
}

export interface ContactUsAttachment { fileName: string; url: string; contentType: string; sizeBytes: number; }

export interface ContactUsDetail extends ContactUsListItem {
  message: string;
  viewedAtUtc: string | null;
  viewedByAdminUserId: string | null;
  viewedByAdminName: string | null;
  closedAtUtc: string | null;
  attachments: ContactUsAttachment[];
}

export interface ContactUsListResponse {
  data: ContactUsListItem[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
}

export interface ContactUsListParams { status?: ContactUsStatus; search?: string; page: number; pageSize: number; }
