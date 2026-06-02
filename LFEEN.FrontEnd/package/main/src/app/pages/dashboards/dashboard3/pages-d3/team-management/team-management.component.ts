import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { DepartmentService, Department, Employee } from './department.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { AddEmployeeDialogComponent } from './components/add-employee-dialog/add-employee-dialog.component';
import { DeleteConfirmDialogComponent } from './components/delete-confirm-dialog/delete-confirm-dialog.component';


import { TeamHeaderComponent } from './components/team-header/team-header.component';
import { EmployeeListComponent } from './components/employee-list/employee-list.component';

@Component({
  selector: 'app-team-management',
  standalone: true,
  imports: [
    CommonModule, 
    MaterialModule, 
    TablerIconsModule, 
    RouterModule, 
    TranslateModule,
    TeamHeaderComponent,
    EmployeeListComponent
  ],
  templateUrl: './team-management.component.html',
  styleUrl: './team-management.component.scss'
})
export class TeamManagementComponent implements OnInit {
  activeTab: 'structure' | 'employees' | 'logs' = 'structure';
  stats: any[] = [];
  departments: Department[] = [];
  departmentId: string | null = null;
  selectedDepartment: Department | null = null;
  employees: Employee[] = [];

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
    private dialog: MatDialog,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.departmentId = params['id'] || null;
      if (this.departmentId) {
        this.activeTab = 'employees';
        this.loadDepartmentDetails(this.departmentId);
      } else {
        this.loadDepartments();
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

    this.departmentService.getDepartmentEmployees(id).subscribe({
      next: (employees) => {
        this.employees = employees;
      },
      error: (err) => console.error('Error fetching employees', err)
    });
  }

  setActiveTab(tab: 'structure' | 'employees' | 'logs'): void {
    this.activeTab = tab;
    if (tab === 'employees' && !this.departmentId) {
      this.loadAllEmployees();
    }
    this.updateStats();
  }

  loadAllEmployees(): void {
    // Using static data as the endpoint /api/departments/employees is not available yet
    this.employees = [
      {
        userId: '1',
        fullName: 'فهد السيف',
        email: 'fahad@lafin.sa',
        phoneNumber: '0554438173',
        isActive: true,
        roles: [{ roleId: 'r1', nameAr: 'مدير القسم', nameEn: 'Dept Manager', descriptionAr: '', descriptionEn: '' }]
      },
      {
        userId: '2',
        fullName: 'أحمد المنصور',
        email: 'ahmed@lafin.sa',
        phoneNumber: '0567119923',
        isActive: true,
        roles: [{ roleId: 'r2', nameAr: 'مشرف تشغيل', nameEn: 'Ops Supervisor', descriptionAr: '', descriptionEn: '' }]
      },
      {
        userId: '3',
        fullName: 'نورة الشهري',
        email: 'noura@lafin.sa',
        phoneNumber: '0533311000',
        isActive: false,
        roles: [{ roleId: 'r3', nameAr: 'منسقة عمليات', nameEn: 'Ops Coordinator', descriptionAr: '', descriptionEn: '' }]
      }
    ];
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
    } else {
      this.stats = [
        { label: 'd3.teamManagement.stats.totalEmployees', value: 156, icon: 'assets/images/svgs/Group.svg', color: 'primary', valueColor: '#000' },
        { label: 'd3.teamManagement.stats.activeManagers', value: 12, icon: 'assets/images/svgs/Group (2).svg', color: 'success', valueColor: '#16a34a' },
        { label: 'd3.teamManagement.stats.departmentCount', value: 8, icon: 'assets/images/svgs/Group (1).svg', color: 'accent', valueColor: '#000' },
        { label: 'd3.teamManagement.stats.pendingActivation', value: 5, icon: 'assets/images/svgs/Group (3).svg', color: 'warning', valueColor: '#d97706' }
      ];
    }
  }

  onEditEmployee(employee: Employee): void {
    if (!this.departmentId) return;
    
    const dialogRef = this.dialog.open(AddEmployeeDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data: { 
        departmentId: this.departmentId,
        employee: employee
      },
      panelClass: 'custom-dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadDepartmentDetails(this.departmentId!);
      }
    });
  }

  onDeleteEmployee(employee: Employee): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '440px',
      data: {
        title: 'common.deleteConfirmTitle',
        message: 'common.deleteConfirmMessage'
      },
      panelClass: 'custom-confirm-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.departmentService.deleteEmployee(employee.userId).subscribe({
          next: () => {
            this.toastr.success(
              this.currentLang === 'ar' ? 'تم حذف الموظف بنجاح' : 'Employee deleted successfully'
            );
            if (this.departmentId) {
              this.loadDepartmentDetails(this.departmentId);
            } else {
              this.loadAllEmployees();
            }
          },
          error: (err) => {
            console.error('Error deleting employee', err);
            this.toastr.error(
              this.currentLang === 'ar' ? 'حدث خطأ أثناء الحذف' : 'Error deleting employee'
            );
          }
        });
      }
    });
  }

  onHeaderAction(): void {
    if (this.activeTab === 'structure') {
      console.log('Add Department clicked');
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
      if (result) {
        this.loadDepartmentDetails(this.departmentId!);
      }
    });
  }

  loadDepartments(): void {
    this.departmentService.getDepartments().subscribe({
      next: (data) => {
        this.departments = data;
        this.updateStats();
      },
      error: (err) => console.error('Error fetching departments', err)
    });
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }
}
