export interface Department {
  id: string;
  name?: string;
  nameAr?: string;
  nameEn?: string;
  code: string;
  icon: string | null;
  description?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  managerId: string | null;
  managerFullName: string | null;
  managerAvatar?: string | null;
  employeeCount: number;
  activeManagersCount?: number;
  pendingActivationCount?: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface PaginatedDepartmentResponse {
  data: Department[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
}

export interface EmployeeRole {
  id?: string;
  roleId: string;
  name?: string;
  nameAr?: string;
  nameEn?: string;
  description?: string;
  descriptionAr?: string;
  descriptionEn?: string;
}

export interface Employee {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  avatar?: string | null;
  roles: EmployeeRole[];
}

export interface PaginatedEmployeeResponse {
  data: Employee[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
}

export interface DepartmentRole {
  id: string;
  name?: string;
  nameAr?: string;
  nameEn?: string;
  description?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  departmentId: string | null;
  departmentNameAr?: string | null;
  departmentNameEn?: string | null;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface RolePermission {
  id: string;
  permissionGroupId: string;
  permissionGroupName: string;
  code: string;
  name: string;
  description: string;
  action: string;
  createdAt: string;
  updatedAt: string | null;
  impliedPermissionIds: string[];
}

export interface RolePermissionsResponse {
  data: RolePermission[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
}
