export interface DepartmentManager {
  id: string;
  fullName: string;
  avatar?: string | null;
}

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
  managers: DepartmentManager[];
  managerId?: string | null;
  managerFullName?: string | null;
  managerAvatar?: string | null;
  employeeCount: number;
  activeManagersCount?: number;
  pendingActivationCount?: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface DepartmentStats {
  totalDepartments: number;
  totalEmployees: number;
  activeManagers: number;
}

export interface PaginatedDepartmentResponse {
  data: Department[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
  stats: DepartmentStats;
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
  isManagerRole?: boolean;
}

export interface Employee {
  userId: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  avatar?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentNameAr?: string | null;
  departmentNameEn?: string | null;
  roles: EmployeeRole[];
}

export interface DeptEmployeeStats {
  totalTeam: number;
  activeManagers: number;
  inactiveEmployees: number;
}

export interface PaginatedEmployeeResponse {
  data: Employee[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
  stats?: DeptEmployeeStats;
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
  isManagerRole: boolean;
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

export interface RolePayload {
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  departmentId: string;
  isManagerRole: boolean;
}

export interface EmployeeFormData {
  fullName: string;
  email: string;
  phoneNumber: string;
  roleIds: string[];
}

export type UpdateEmployeePayload = EmployeeFormData;
