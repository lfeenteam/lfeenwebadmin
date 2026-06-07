import { Component, OnInit, effect, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { DepartmentService } from '../../services/department.service';
import { Department, Employee } from '../../interfaces/department.model';
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
import { LogsFilterComponent } from './components/logs-filter/logs-filter.component';
import { OpsLogTableComponent, OpsLog } from './components/ops-log-table/ops-log-table.component';

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
    OpsLogTableComponent
  ],
  templateUrl: './team-management.component.html',
  styleUrl: './team-management.component.scss'
})
export class TeamManagementComponent implements OnInit {
  activeTab: 'structure' | 'employees' | 'logs' = 'structure';
  stats: any[] = [];
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
  employeeTotalPages = 1;
  employeeTotalCount = 0;
  employeeCurrentPage = 1;
  employeePageNumbers: number[] = [];
  isLoadingEmployees = false;

  logsSearchQuery = '';
  logsFilterAction = '';
  logsFilterDept = '';
  logsFilterDate = '';

  logsActionTypes = ['تعديل الصلاحيات', 'إضافة موظف', 'حذف وحدة', 'اعتماد مستندات'];
  logsDepts = ['التشغيل', 'خدمة العملاء', 'المباني', 'التقنية'];
  logsDates = ['اليوم', 'هذا الأسبوع', 'هذا الشهر'];

  opsLogs: OpsLog[] = [
    {
      id: '1',
      date: '١٤ أكتوبر ٢٠٢٤',
      time: '١١:٤٥ م',
      user: { name: 'فهد السيف', role: 'مدير التشغيل', avatar: 'assets/images/profile/user-1.jpg', isCrown: true },
      actionText: 'تعديل صلاحيات الوصول للقسم',
      actionIcon: 'user-cog',
      department: 'التشغيل',
      status: 'completed',
      statusLabel: 'مكتمل'
    },
    {
      id: '2',
      date: '١٤ أكتوبر ٢٠٢٤',
      time: '٩:٣٠ م',
      user: { name: 'ريم العبدالله', role: 'مديرة خدمة العملاء', avatar: 'assets/images/profile/user-2.jpg', isCrown: true },
      actionText: 'إضافة موظف جديد للفريق',
      actionIcon: 'user-plus',
      department: 'خدمة العملاء',
      status: 'completed',
      statusLabel: 'مكتمل'
    },
    {
      id: '3',
      date: '١٤ أكتوبر ٢٠٢٤',
      time: '٩:٠٥ م',
      user: { name: 'ياسر الحربي', role: 'مدير التقنية', avatar: 'assets/images/profile/user-3.jpg', isCrown: true },
      actionText: 'محاولة حذف وحدة سكنية نشطة',
      actionIcon: 'file-x',
      department: 'المباني',
      status: 'failed',
      statusLabel: 'خطأ النظام'
    },
    {
      id: '4',
      date: '١٤ أكتوبر ٢٠٢٤',
      time: '٩:٣٤ م',
      user: { name: 'أحمد المنصور', role: 'موظف تشغيل', avatar: null, isCrown: false },
      actionText: 'اعتماد مستندات مبنى جديد',
      actionIcon: 'file-check',
      department: 'المباني',
      status: 'completed',
      statusLabel: 'مكتمل'
    }
  ];

  get filteredLogs(): OpsLog[] {
    return this.opsLogs.filter(log => {
      const q = this.logsSearchQuery.trim();
      const matchSearch = !q || log.user.name.includes(q) || log.actionText.includes(q) || log.department.includes(q);
      const matchAction = !this.logsFilterAction || log.actionText.includes(this.logsFilterAction);
      const matchDept = !this.logsFilterDept || log.department === this.logsFilterDept;
      return matchSearch && matchAction && matchDept;
    });
  }

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
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.departmentId = params['id'] || null;
      if (this.departmentId) {
        this.activeTab = 'employees';
        this.loadDepartmentDetails(this.departmentId);
      } else {
        this.updateStats();
      }
    });
  }

  loadDepartmentDetails(id: string): void {
    this.departmentService.getDepartmentById(id).subscribe({
      next: (dept) => {
        this.selectedDepartment = dept;
        this.updateStats();
      },
      error: (err) => console.error('Error fetching department details', err)
    });

    this.departmentService.loadEmployeesForDept(id);
  }

  setActiveTab(tab: 'structure' | 'employees' | 'logs'): void {
    this.activeTab = tab;
    if (tab === 'employees' && !this.departmentId) {
      this.loadAllEmployees();
    }
    this.updateStats();
  }

  loadAllEmployees(): void {
    this.departmentService.loadEmployeesForDept(null);
    this.updateStats();
  }

  updateStats(): void {
    if (this.departmentId && this.selectedDepartment) {
      this.stats = [
        { label: 'd3.teamManagement.stats.totalEmployees', value: this.selectedDepartment.employeeCount, icon: 'assets/images/svgs/Group.svg', color: 'primary', valueColor: '#000' },
        { label: 'd3.teamManagement.stats.activeManagers', value: this.selectedDepartment.activeManagersCount || 0, icon: 'assets/images/svgs/Group (2).svg', color: 'success', valueColor: '#16a34a' },
        { label: 'd3.teamManagement.stats.pendingActivation', value: this.selectedDepartment.pendingActivationCount || 0, icon: 'assets/images/svgs/Group (3).svg', color: 'warning', valueColor: '#d97706' }
      ];
    } else if (this.activeTab === 'structure') {
      this.stats = [
        { label: 'd3.teamManagement.stats.totalEmployees', value: 0, icon: 'assets/images/svgs/Group.svg', color: 'primary', valueColor: '#000' },
        { label: 'd3.teamManagement.stats.departmentCount', value: 0, icon: 'assets/images/svgs/Group (1).svg', color: 'accent', valueColor: '#000' },
        { label: 'd3.teamManagement.stats.activeManagers', value: 12, icon: 'assets/images/svgs/Group (2).svg', color: 'success', valueColor: '#16a34a' },
        { label: 'd3.teamManagement.stats.pendingActivation', value: 5, icon: 'assets/images/svgs/Group (3).svg', color: 'warning', valueColor: '#d97706' }
      ];
      if (this.departments.length > 0) {
        this.stats[0].value = this.departments.reduce((sum, d) => sum + d.employeeCount, 0);
        this.stats[1].value = this.departments.length;
      }
    } else if (this.activeTab === 'logs') {
      this.stats = [
        { label: 'd3.teamManagement.stats.totalOps', value: '١٢,٨٤٧', icon: 'database', color: 'primary', valueColor: '#000' },
        { label: 'd3.teamManagement.stats.successfulOps', value: '١٢,٨٠٠', icon: 'circle-check', color: 'success', valueColor: '#16a34a' },
        { label: 'd3.teamManagement.stats.partialOps', value: '١٢', icon: 'alert-triangle', color: 'warning', valueColor: '#d97706' },
        { label: 'd3.teamManagement.stats.rejectedOps', value: '٤٧', icon: 'circle-x', color: 'danger', valueColor: '#ef4444' }
      ];
    } else {
      this.stats = [
        { label: 'd3.teamManagement.stats.totalEmployees', value: 156, icon: 'assets/images/svgs/Group.svg', color: 'primary', valueColor: '#000' },
        { label: 'd3.teamManagement.stats.activeManagers', value: 12, icon: 'assets/images/svgs/Group (2).svg', color: 'success', valueColor: '#16a34a' },
        { label: 'd3.teamManagement.stats.departmentCount', value: 8, icon: 'assets/images/svgs/Group (1).svg', color: 'accent', valueColor: '#000' },
        { label: 'd3.teamManagement.stats.pendingActivation', value: 5, icon: 'assets/images/svgs/Group (3).svg', color: 'warning', valueColor: '#d97706' }
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
    if (!this.departmentId) return;

    const dialogRef = this.dialog.open(AddEmployeeDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data: { departmentId: this.departmentId, employee },
      panelClass: 'custom-dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadDepartmentDetails(this.departmentId!);
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
            this.toastr.success(this.currentLang === 'ar' ? 'تم حذف الموظف بنجاح' : 'Employee deleted successfully');
            if (this.departmentId) this.loadDepartmentDetails(this.departmentId);
            else this.loadAllEmployees();
          },
          error: (err) => {
            console.error('Error deleting employee', err);
            this.toastr.error(this.currentLang === 'ar' ? 'حدث خطأ أثناء الحذف' : 'Error deleting employee');
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
    if (!this.departmentId) return;

    const dialogRef = this.dialog.open(AddEmployeeDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data: { departmentId: this.departmentId },
      panelClass: 'custom-dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadDepartmentDetails(this.departmentId!);
    });
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }
}
