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
  departmentId: string;
  createdAt: string;
  updatedAt: string | null;
}
