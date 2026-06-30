import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { rxResource } from '@angular/core/rxjs-interop';
import {
  Department,
  DepartmentStats,
  DeptEmployeeStats,
  PaginatedDepartmentResponse,
  Employee,
  PaginatedEmployeeResponse,
  DepartmentRole,
  RolePermission,
  RolePermissionsResponse,
  RolePayload,
  EmployeeFormData,
  UpdateEmployeePayload
} from '../interfaces/department.model';
import { CoreService } from 'src/app/services/core.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private http = inject(HttpClient);
  private coreService = inject(CoreService);
  private apiUrl = `${environment.apiBaseUrl}/api/departments`;

  readonly currentPage = signal(1);
  readonly pageSize = signal(9);

  private readonly _departmentsResource = rxResource({
    request: () => ({ page: this.currentPage(), pageSize: this.pageSize(), lang: this.coreService.getOptionsSignal()().language }),
    loader: ({ request }) =>
      this.http.get<PaginatedDepartmentResponse>(
        `${this.apiUrl}?page=${request.page}&pageSize=${request.pageSize}`
      )
  });

  readonly departments      = computed(() => this._departmentsResource.value()?.data ?? []);
  readonly totalPages       = computed(() => this._departmentsResource.value()?.totalPages ?? 1);
  readonly totalCount       = computed(() => this._departmentsResource.value()?.totalCount ?? 0);
  readonly isLoading        = this._departmentsResource.isLoading;
  readonly departmentStats  = computed<DepartmentStats | null>(() => this._departmentsResource.value()?.stats ?? null);

  goToPage(page: number): void {
    this.currentPage.set(page);
  }

  // ── Employees ──────────────────────────────────────────────
  readonly employeeDeptId = signal<string | null>(null);
  readonly employeeCurrentPage = signal(1);
  readonly employeePageSize = signal(10);
  readonly employeeSearch = signal('');
  readonly employeeRoleId = signal<string | null>(null);

  private readonly _employeesResource = rxResource({
    request: () => ({
      deptId: this.employeeDeptId(),
      page: this.employeeCurrentPage(),
      pageSize: this.employeePageSize(),
      search: this.employeeSearch(),
      roleId: this.employeeRoleId(),
      lang: this.coreService.getOptionsSignal()().language,
    }),
    loader: ({ request }) => {
      const params = new URLSearchParams({
        page: String(request.page),
        pageSize: String(request.pageSize)
      });
      if (request.search) params.set('search', request.search);
      if (request.roleId) params.set('roleId', request.roleId);

      const url = request.deptId
        ? `${this.apiUrl}/${request.deptId}/employees?${params}`
        : `${this.apiUrl}/employees?${params}`;

      return this.http.get<PaginatedEmployeeResponse>(url);
    }
  });

  readonly employees = computed(() => this._employeesResource.value()?.data ?? []);
  readonly employeeTotalPages = computed(() => this._employeesResource.value()?.totalPages ?? 1);
  readonly employeeTotalCount = computed(() => this._employeesResource.value()?.totalCount ?? 0);
  readonly isLoadingEmployees = this._employeesResource.isLoading;
  readonly employeesError = this._employeesResource.error;
  readonly deptEmployeeStats = computed<DeptEmployeeStats | null>(() => this._employeesResource.value()?.stats ?? null);

  loadEmployeesForDept(deptId: string | null): void {
    this.employeeDeptId.set(deptId);
    this.employeeCurrentPage.set(1);
    // Always force-reload: on first page load the resource may be in an error/stale
    // state from the initial null-dept request, so we can't rely solely on signal reactivity
    this._employeesResource.reload();
  }

  setEmployeeSearch(search: string): void {
    this.employeeSearch.set(search);
    this.employeeCurrentPage.set(1);
  }

  setEmployeeRoleId(roleId: string | null): void {
    this.employeeRoleId.set(roleId);
    this.employeeCurrentPage.set(1);
  }

  setEmployeeDeptFilter(deptId: string | null): void {
    this.employeeDeptId.set(deptId);
    this.employeeCurrentPage.set(1);
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

  getAllDepartmentsForDropdown(): Observable<Department[]> {
    return this.http.get<PaginatedDepartmentResponse>(`${this.apiUrl}?page=1&pageSize=100`).pipe(
      map(res => res.data)
    );
  }

  getDepartmentRoles(id: string): Observable<DepartmentRole[]> {
    return this.http.get<{ data: DepartmentRole[] }>(`${this.apiUrl}/${id}/roles`).pipe(
      map(res => res.data)
    );
  }

  getAllRolesForDropdown(): Observable<DepartmentRole[]> {
    return this.http.get<{ data: DepartmentRole[] }>(
      `${this.rolesApiUrl}?page=1&pageSize=100`
    ).pipe(
      map(res => res.data)
    );
  }

  addEmployee(id: string, employeeData: EmployeeFormData): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/employees`, employeeData);
  }

  getEmployeeById(userId: string): Observable<Employee> {
    return this.http.get<Employee>(`${this.apiUrl}/employees/${userId}`);
  }

  updateEmployee(departmentId: string, userId: string, employee: UpdateEmployeePayload): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${departmentId}/employees/${userId}`, employee);
  }

  deleteEmployee(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/employees/${userId}`);
  }

  activateEmployee(userId: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/employees/${userId}/activate`, {});
  }

  deactivateEmployee(userId: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/employees/${userId}/deactivate`, {});
  }

  createDepartment(data: { nameAr: string; nameEn: string; code: string; descriptionAr: string; descriptionEn: string; managerId: string }): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }

  // ── Roles ──────────────────────────────────────────────────
  private rolesApiUrl = `${environment.apiBaseUrl}/api/roles`;

  createRole(data: RolePayload): Observable<any> {
    return this.http.post(this.rolesApiUrl, data);
  }

  getRoleById(id: string): Observable<DepartmentRole> {
    return this.http.get<DepartmentRole>(`${this.rolesApiUrl}/${id}`);
  }

  updateRole(id: string, data: RolePayload): Observable<any> {
    return this.http.put(`${this.rolesApiUrl}/${id}`, data);
  }

  deleteRole(id: string): Observable<any> {
    return this.http.delete(`${this.rolesApiUrl}/${id}`);
  }

  getRolePermissions(roleId: string): Observable<RolePermission[]> {
    return this.http.get<RolePermissionsResponse>(`${this.rolesApiUrl}/${roleId}/permissions`).pipe(
      map(res => res.data)
    );
  }

  deleteRolePermission(roleId: string, permissionId: string): Observable<any> {
    return this.http.delete(`${this.rolesApiUrl}/${roleId}/permissions/${permissionId}`);
  }

  // ── Permissions ────────────────────────────────────────────
  private permissionsApiUrl = `${environment.apiBaseUrl}/api/permissions`;

  getPermissions(pageSize: number = 100): Observable<RolePermission[]> {
    return this.http.get<RolePermissionsResponse>(`${this.permissionsApiUrl}?page=1&pageSize=${pageSize}`).pipe(
      map(res => res.data)
    );
  }

  bulkAssignPermissions(roleId: string, permissionIds: string[]): Observable<any> {
    return this.http.post(`${this.rolesApiUrl}/${roleId}/permissions/bulk`, { permissionIds });
  }
}
