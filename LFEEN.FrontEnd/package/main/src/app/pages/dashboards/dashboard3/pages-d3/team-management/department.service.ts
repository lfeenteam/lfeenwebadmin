import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Department {
  id: string;
  nameAr: string;
  nameEn: string;
  code: string;
  icon: string | null;
  descriptionAr: string;
  descriptionEn: string;
  managerId: string | null;
  managerFullName: string | null;
  managerAvatar?: string | null;
  employeeCount: number;
  activeManagersCount?: number;
  pendingActivationCount?: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface EmployeeRole {
  id?: string;
  roleId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export interface DepartmentRole {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  departmentId: string;
  createdAt: string;
  updatedAt: string | null;
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

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private apiUrl = 'http://test-api-admin.lfeen.com/api/departments';

  constructor(private http: HttpClient) {}

  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(this.apiUrl);
  }

  getDepartmentById(id: string): Observable<Department> {
    return this.http.get<Department>(`${this.apiUrl}/${id}`);
  }

  getDepartmentEmployees(id: string): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${this.apiUrl}/${id}/employees`);
  }

  getAllEmployees(): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${this.apiUrl}/employees`);
  }

  getDepartmentRoles(id: string): Observable<DepartmentRole[]> {
    return this.http.get<DepartmentRole[]>(`${this.apiUrl}/${id}/roles`);
  }

  addEmployee(id: string, employeeData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/employees`, employeeData);
  }

  getEmployeeById(userId: string): Observable<Employee> {
    return this.http.get<Employee>(`${this.apiUrl}/employees/${userId}`);
  }

  updateEmployee(departmentId: string, userId: string, employee: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${departmentId}/employees/${userId}`, employee);
  }

  deleteEmployee(userId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/employees/${userId}`);
  }
}
