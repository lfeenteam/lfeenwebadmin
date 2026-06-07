export interface LoginRequest {
  email: string;
  password: string;
}

export interface SidebarItem {
  id: string;
  key: string;
  title?: string;
  titleAr?: string;
  titleEn?: string;
  icon: string | null;
  route: string | null;
  requiredPermission: string | null;
  order: number;
  children: SidebarItem[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  userId: string;
  fullName: string;
  email: string;
  roles: string[];
  permissions: string[];
  sidebar: SidebarItem[];
}
