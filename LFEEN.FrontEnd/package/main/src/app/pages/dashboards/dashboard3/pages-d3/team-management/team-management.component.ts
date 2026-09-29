import { Component, OnInit, OnDestroy, effect, ChangeDetectorRef, DestroyRef, Injector, computed, inject } from '@angular/core';
import { combineLatest } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { DepartmentService } from '../../services/department.service';
import { Department, DepartmentRole, Employee } from '../../interfaces/department.model';
import { StatItem } from '../../interfaces/stats.model';
import { ADMIN_AUDIT_ACTION_CODES, ADMIN_AUDIT_STATUSES, AdminOperationAuditItem } from '../../interfaces/operation-audit.model';
import { OperationAuditsService } from '../../services/operation-audits.service';
import { LoginService } from '../../services/login/login.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { AddEmployeeDialogComponent } from './components/add-employee-dialog/add-employee-dialog.component';
import { DeleteConfirmDialogComponent } from './components/delete-confirm-dialog/delete-confirm-dialog.component';
import { TeamHeaderComponent } from './components/team-header/team-header.component';
import { EmployeeListComponent } from './components/employee-list/employee-list.component';
import { StatsRowComponent } from './components/stats-row/stats-row.component';
import { TabsBarComponent } from './components/tabs-bar/tabs-bar.component';
import { DeptCardComponent } from './components/dept-card/dept-card.component';
import { ManagerCardComponent } from './components/manager-card/manager-card.component';
import { LogsFilterComponent, LogsFilterOption } from './components/logs-filter/logs-filter.component';
import { OpsLogTableComponent } from './components/ops-log-table/ops-log-table.component';
import {
  AUDIT_DETAIL_NOT_FOUND,
  AuditDetailDrawerComponent,
  AuditDetailDrawerData
} from './components/audit-detail-drawer/audit-detail-drawer.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { PageTitleOverrideService } from '../../services/page-title-override.service';

@Component({
  selector: 'app-team-management',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    MaterialModule,
    TablerIconsModule,
    TeamHeaderComponent,
    EmployeeListComponent,
    StatsRowComponent,
    TabsBarComponent,
    DeptCardComponent,
    ManagerCardComponent,
    LogsFilterComponent,
    OpsLogTableComponent,
    DashboardLoadingComponent
  ],
  // Scoped here so audit rows are discarded with the page (never shared across sign-ins).
  providers: [OperationAuditsService],
  templateUrl: './team-management.component.html',
  styleUrl: './team-management.component.scss'
})
export class TeamManagementComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly pageTitleOverride = inject(PageTitleOverrideService);
  private readonly loginService = inject(LoginService);
  readonly audits = inject(OperationAuditsService);

  readonly canViewAudits = computed(() =>
    this.loginService.permissions().some(p => p.toLowerCase() === 'operationaudits.view')
  );

  activeTab: 'structure' | 'employees' | 'logs' = 'structure';
  stats: StatItem[] = [];
  departmentId: string | null = null;
  selectedDepartment: Department | null = null;

  // Synced from service signals via effect()
  departments: Department[] = [];
  totalPages = 1;
  totalCount = 0;
  currentPage = 1;
  pageNumbers: number[] = [];
  isLoadingDepts = false;

  employees: Employee[] = [];
  filterDepartments: Department[] = [];
  filterRoles: DepartmentRole[] = [];
  employeeTotalPages = 1;
  employeeTotalCount = 0;
  employeeCurrentPage = 1;
  employeePageNumbers: number[] = [];
  isLoadingEmployees = false;

  readonly auditActionCodes = ADMIN_AUDIT_ACTION_CODES;
  readonly auditStatuses = ADMIN_AUDIT_STATUSES;
  logsDeptOptions: LogsFilterOption[] = [];

  iconMap: { [key: string]: string } = {
    'CS': 'headset',
    'IT': 'code',
    'OPS': 'briefcase',
    'TECH': 'settings'
  };

  constructor(
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private toastr: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    // Sync departments signals
    effect(() => {
      this.departments = this.departmentService.departments();
      this.totalPages = this.departmentService.totalPages();
      this.totalCount = this.departmentService.totalCount();
      this.currentPage = this.departmentService.currentPage();
      this.isLoadingDepts = this.departmentService.isLoading();
      this.pageNumbers = Array.from({ length: this.totalPages }, (_, i) => i + 1);
      if (!this.departmentId) this.updateStats();
      this.cdr.markForCheck();
    });

    // Sync employees signals
    effect(() => {
      this.employees = this.departmentService.employees();
      this.employeeTotalPages = this.departmentService.employeeTotalPages();
      this.employeeTotalCount = this.departmentService.employeeTotalCount();
      this.employeeCurrentPage = this.departmentService.employeeCurrentPage();
      this.isLoadingEmployees = this.departmentService.isLoadingEmployees();
      this.employeePageNumbers = Array.from({ length: this.employeeTotalPages }, (_, i) => i + 1);
      if (this.departmentId) this.updateStats();
      this.cdr.markForCheck();
    });

    // Refresh the audit stat cards whenever their counts arrive
    effect(() => {
      this.audits.stats();
      if (this.activeTab === 'logs') this.updateStats();
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.loadEmployeeFilterOptions();

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadEmployeeFilterOptions();
        if (this.departmentId) {
          this.loadDepartmentDetails(this.departmentId);
        }
      });

    combineLatest([this.route.params, this.route.queryParams])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, queryParams]) => {
        this.departmentId = params['id'] || null;
        if (this.departmentId) {
          this.activeTab = 'employees';
          this.loadDepartmentDetails(this.departmentId);
        } else {
          this.pageTitleOverride.clear();
          if (queryParams['tab'] === 'employees') {
            this.setActiveTab('employees');
          } else if (queryParams['tab'] === 'logs' && this.canViewAudits()) {
            this.setActiveTab('logs');
          } else {
            this.activeTab = 'structure';
            this.updateStats();
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.pageTitleOverride.clear();
  }

  loadEmployeeFilterOptions(): void {
    this.departmentService.getAllDepartmentsForDropdown().subscribe({
      next: departments => {
        this.filterDepartments = departments;
        this.logsDeptOptions = departments.map(dept => ({
          value: dept.id,
          label: (this.currentLang === 'ar' ? dept.nameAr : dept.nameEn) ?? dept.name ?? dept.code
        }));
        this.cdr.markForCheck();
      },
      error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp'))
    });

    this.departmentService.getAllRolesForDropdown().subscribe({
      next: roles => {
        this.filterRoles = roles.filter(role => !role.isDeleted);
        this.cdr.markForCheck();
      },
      error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp'))
    });
  }

  onEmployeeSearch(query: string): void {
    this.departmentService.setEmployeeSearch(query);
  }

  onFilterDept(deptId: string): void {
    this.departmentService.setEmployeeDeptFilter(deptId || null);
  }

  onFilterRole(roleId: string): void {
    this.departmentService.setEmployeeRoleId(roleId || null);
  }

  loadDepartmentDetails(id: string): void {
    this.departmentService.getDepartmentById(id).subscribe({
      next: (dept) => {
        this.selectedDepartment = dept;
        this.updateStats();
        this.pageTitleOverride.set(
          this.currentLang === 'ar' ? (dept.nameAr ?? dept.name) : (dept.nameEn ?? dept.name)
        );
      },
      error: () => undefined
    });

    this.departmentService.loadEmployeesForDept(id);
  }

  setActiveTab(tab: 'structure' | 'employees' | 'logs'): void {
    if (tab === 'logs' && !this.canViewAudits()) return;

    this.activeTab = tab;
    if (tab === 'employees' && !this.departmentId) {
      this.loadAllEmployees();
    }
    if (tab === 'logs') {
      this.audits.activate();
    }
    this.updateStats();
  }

  // ── Operation audits ───────────────────────────────────────
  openAuditDetails(item: AdminOperationAuditItem): void {
    const isRtl = this.currentLang === 'ar';
    const dialogRef = this.dialog.open<AuditDetailDrawerComponent, AuditDetailDrawerData, string>(
      AuditDetailDrawerComponent,
      {
        data: { item, lang: this.currentLang },
        // The drawer reads details through this page's OperationAuditsService instance.
        injector: this.injector,
        direction: isRtl ? 'rtl' : 'ltr',
        position: { top: '0', right: '0' },
        width: '480px',
        maxWidth: '100vw',
        height: '100vh',
        autoFocus: false,
        panelClass: 'audit-drawer-panel'
      }
    );

    dialogRef.afterClosed().subscribe(result => {
      if (result === AUDIT_DETAIL_NOT_FOUND) this.audits.reload();
    });
  }

  loadAllEmployees(): void {
    this.departmentService.loadEmployeesForDept(null);
    this.updateStats();
  }

  updateStats(): void {
    if (this.departmentId && this.selectedDepartment) {
      const s = this.departmentService.deptEmployeeStats();
      this.stats = [
        { label: 'd3.teamManagement.stats.totalEmployees', value: s?.totalTeam ?? this.selectedDepartment.employeeCount, icon: 'assets/images/svgs/Group.svg', color: 'primary', valueColor: '#000' },
        { label: 'd3.teamManagement.stats.activeManagers', value: s?.activeManagers ?? 0, icon: 'assets/images/svgs/Group (2).svg', color: 'success', valueColor: '#16a34a' },
        { label: 'd3.teamManagement.stats.pendingActivation', value: s?.inactiveEmployees ?? 0, icon: 'assets/images/svgs/Group (3).svg', color: 'warning', valueColor: '#d97706' }
      ];
    } else if (this.activeTab === 'structure') {
      const s = this.departmentService.departmentStats();
      this.stats = [
        { label: 'd3.teamManagement.stats.totalEmployees',  value: s?.totalEmployees  ?? '—', icon: 'assets/images/svgs/Group.svg',     color: 'primary', valueColor: '#000'    },
        { label: 'd3.teamManagement.stats.departmentCount', value: s?.totalDepartments ?? '—', icon: 'assets/images/svgs/Group (1).svg', color: 'accent',  valueColor: '#000'    },
        { label: 'd3.teamManagement.stats.activeManagers',  value: s?.activeManagers   ?? '—', icon: 'assets/images/svgs/Group (2).svg', color: 'success', valueColor: '#16a34a' },
      ];
    } else if (this.activeTab === 'logs') {
      const s = this.audits.stats();
      const fmt = (n: number | undefined) =>
        n === undefined ? '—' : n.toLocaleString(this.currentLang === 'ar' ? 'ar-EG' : 'en-US');
      this.stats = [
        { label: 'd3.teamManagement.stats.totalOps', value: fmt(s?.total), icon: 'database', color: 'primary', valueColor: '#000' },
        { label: 'd3.teamManagement.stats.successfulOps', value: fmt(s?.succeeded), icon: 'circle-check', color: 'success', valueColor: '#16a34a' },
        { label: 'd3.teamManagement.stats.failedOps', value: fmt(s?.failed), icon: 'alert-triangle', color: 'danger', valueColor: '#ef4444' },
        { label: 'd3.teamManagement.stats.rejectedOps', value: fmt(s?.denied), icon: 'circle-x', color: 'warning', valueColor: '#d97706' }
      ];
    } else {
      const s = this.departmentService.departmentStats();
      this.stats = [
        { label: 'd3.teamManagement.stats.totalEmployees',  value: s?.totalEmployees   ?? '—', icon: 'assets/images/svgs/Group.svg',     color: 'primary', valueColor: '#000' },
        { label: 'd3.teamManagement.stats.departmentCount', value: s?.totalDepartments ?? '—', icon: 'assets/images/svgs/Group (1).svg', color: 'accent',  valueColor: '#000' },
      ];
    }
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.departmentService.goToPage(page);
  }

  changeEmployeePage(page: number): void {
    if (page < 1 || page > this.employeeTotalPages) return;
    this.departmentService.goToEmployeePage(page);
  }

  onEditEmployee(employee: Employee): void {
    const deptId = this.departmentId || employee.departmentId || '';

    const dialogRef = this.dialog.open(AddEmployeeDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data: { departmentId: deptId, employee },
      panelClass: 'custom-dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (this.departmentId) this.loadDepartmentDetails(this.departmentId);
        else this.loadAllEmployees();
      }
    });
  }

  onDeleteEmployee(employee: Employee): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '440px',
      data: { title: 'common.deleteConfirmTitle', message: 'common.deleteConfirmMessage' },
      panelClass: 'custom-confirm-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.departmentService.deleteEmployee(employee.userId).subscribe({
          next: () => {
            this.toastr.success(this.translate.instant('d3.toast.deleteEmployeeSuccess'));
            if (this.departmentId) this.loadDepartmentDetails(this.departmentId);
            else this.loadAllEmployees();
          },
          error: (err) => {
            this.toastr.error(this.translate.instant('d3.toast.deleteEmployeeError'));
          }
        });
      }
    });
  }

  onToggleStatusEmployee(employee: Employee): void {
    const isActivating = !employee.isActive;
    const titleKey = isActivating ? 'common.activateConfirmTitle' : 'common.deactivateConfirmTitle';
    const messageKey = isActivating ? 'common.activateConfirmMessage' : 'common.deactivateConfirmMessage';

    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '440px',
      data: { title: titleKey, message: messageKey },
      panelClass: 'custom-confirm-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const call$ = isActivating
          ? this.departmentService.activateEmployee(employee.userId)
          : this.departmentService.deactivateEmployee(employee.userId);

        call$.subscribe({
          next: () => {
            const successKey = isActivating ? 'd3.toast.activateEmployeeSuccess' : 'd3.toast.deactivateEmployeeSuccess';
            this.toastr.success(this.translate.instant(successKey));
            if (this.departmentId) this.loadDepartmentDetails(this.departmentId);
            else this.loadAllEmployees();
          },
          error: (err) => {
            const errorKey = isActivating ? 'd3.toast.activateEmployeeError' : 'd3.toast.deactivateEmployeeError';
            this.toastr.error(this.translate.instant(errorKey));
          }
        });
      }
    });
  }

  onHeaderAction(): void {
    if (this.activeTab === 'structure') {
      this.router.navigate(['add'], { relativeTo: this.route });
    } else if (this.activeTab === 'employees' || this.departmentId) {
      this.openAddEmployeeDialog();
    }
  }

  openAddEmployeeDialog(): void {
    const dialogRef = this.dialog.open(AddEmployeeDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data: {
        departmentId: this.departmentId || '',
        fromAllEmployees: !this.departmentId
      },
      panelClass: 'custom-dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        if (this.departmentId) this.loadDepartmentDetails(this.departmentId);
        else this.loadAllEmployees();
      }
    });
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }
}
