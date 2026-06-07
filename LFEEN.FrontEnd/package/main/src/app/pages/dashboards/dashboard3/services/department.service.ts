import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { rxResource } from '@angular/core/rxjs-interop';
import { CoreService } from '../../../../services/core.service';
import {
  Department,
  PaginatedDepartmentResponse,
  Employee,
  PaginatedEmployeeResponse,
  DepartmentRole
} from '../interfaces/department.model';

export type {
  Department,
  PaginatedDepartmentResponse,
  Employee,
  PaginatedEmployeeResponse,
  DepartmentRole
} from '../interfaces/department.model';
export type { EmployeeRole } from '../interfaces/department.model';

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private http = inject(HttpClient);
  private coreService = inject(CoreService);
  private apiUrl = 'http://test-api-admin.lfeen.com/api/departments';

  readonly currentPage = signal(1);
  readonly pageSize = signal(9);
  private readonly lang = this.coreService.getOptionsSignal();

  private readonly _departmentsResource = rxResource({
    request: () => ({ page: this.currentPage(), pageSize: this.pageSize(), lang: this.lang().language }),
    loader: ({ request }) =>
      this.http.get<PaginatedDepartmentResponse>(
        `${this.apiUrl}?page=${request.page}&pageSize=${request.pageSize}`
      )
  });

  readonly departments = computed(() => this._departmentsResource.value()?.data ?? []);
  readonly totalPages = computed(() => this._departmentsResource.value()?.totalPages ?? 1);
  readonly totalCount = computed(() => this._departmentsResource.value()?.totalCount ?? 0);
  readonly isLoading = this._departmentsResource.isLoading;

  goToPage(page: number): void {
    this.currentPage.set(page);
  }

  // ── Employees ──────────────────────────────────────────────
  readonly employeeDeptId = signal<string | null>(null);
  readonly employeeCurrentPage = signal(1);
  readonly employeePageSize = signal(10);

  private readonly _employeesResource = rxResource({
    request: () => ({
      deptId: this.employeeDeptId(),
      page: this.employeeCurrentPage(),
      pageSize: this.employeePageSize()
    }),
    loader: ({ request }) => {
      const base = request.deptId
        ? `${this.apiUrl}/${request.deptId}/employees`
        : `${this.apiUrl}/employees`;
      return this.http.get<PaginatedEmployeeResponse>(
        `${base}?page=${request.page}&pageSize=${request.pageSize}`
      );
    }
  });

  readonly employees = computed(() => this._employeesResource.value()?.data ?? []);
  readonly employeeTotalPages = computed(() => this._employeesResource.value()?.totalPages ?? 1);
  readonly employeeTotalCount = computed(() => this._employeesResource.value()?.totalCount ?? 0);
  readonly isLoadingEmployees = this._employeesResource.isLoading;

  loadEmployeesForDept(deptId: string | null): void {
    const sameId = this.employeeDeptId() === deptId;
    this.employeeDeptId.set(deptId);
    this.employeeCurrentPage.set(1);
    // rxResource only reacts to signal changes — force reload when dept didn't change
    if (sameId) {
      this._employeesResource.reload();
    }
  }

  goToEmployeePage(page: number): void {
    this.employeeCurrentPage.set(page);
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
    return this.http.get<{ data: DepartmentRole[] }>(`${this.apiUrl}/${id}/roles`).pipe(
      map(res => res.data)
    );
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

  createDepartment(data: { nameAr: string; nameEn: string; code: string; descriptionAr: string; descriptionEn: string; managerId: string }): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  // ── Roles ──────────────────────────────────────────────────
  private rolesApiUrl = 'http://test-api-admin.lfeen.com/api/roles';

  createRole(data: { nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string; departmentId: string }): Observable<any> {
    return this.http.post(this.rolesApiUrl, data);
  }

  getRoleById(id: string): Observable<DepartmentRole> {
    return this.http.get<DepartmentRole>(`${this.rolesApiUrl}/${id}`);
  }

  updateRole(id: string, data: { nameAr: string; nameEn: string; descriptionAr: string; descriptionEn: string; departmentId: string }): Observable<any> {
    return this.http.put(`${this.rolesApiUrl}/${id}`, data);
  }

  deleteRole(id: string): Observable<any> {
    return this.http.delete(`${this.rolesApiUrl}/${id}`);
  }
}
