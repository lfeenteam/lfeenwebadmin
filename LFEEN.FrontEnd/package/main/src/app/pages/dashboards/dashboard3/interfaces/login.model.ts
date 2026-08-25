export interface LoginRequest {
  email: string;
  password: string;
}

export interface SidebarItem {
  id: string;
  key: string;
  title?: string;
  icon: string | null;
  route: string | null;
  requiredPermission: string | null;
  entityId: string | null;
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
  phoneNumber?: string | null;
  roles: string[];
  permissions: string[];
  sidebar: SidebarItem[];
}
