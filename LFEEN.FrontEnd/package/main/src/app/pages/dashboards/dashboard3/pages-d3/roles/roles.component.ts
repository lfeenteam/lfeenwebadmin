import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DepartmentService } from '../../services/department.service';
import { Department, DepartmentRole } from '../../interfaces/department.model';
import { AddRoleDialogComponent } from '../permissions/components/add-role-dialog/add-role-dialog.component';
import { DeleteConfirmDialogComponent } from '../team-management/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { extractApiErrorMessage } from '../../utils/api-error.util';

interface RoleRow {
  id: string;
  name: string;
  description: string;
  departmentId: string | null;
  departmentName: string;
  isManagerRole: boolean;
  raw: DepartmentRole;
}

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.scss'
})
export class RolesComponent implements OnInit, OnDestroy {
  private langSub!: Subscription;

  isLoading = true;
  deletingId: string | null = null;

  departments: Department[] = [];
  allRoles: RoleRow[] = [];
  roles: RoleRow[] = [];

  selectedDeptFilter = '';

  currentPage = 1;
  pageSize = 10;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.roles.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get pagedRoles(): RoleRow[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.roles.slice(start, start + this.pageSize);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  constructor(
    private router: Router,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private dialog: MatDialog,
    private toastr: ToastrService
  ) {}

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  ngOnInit(): void {
    this.langSub = this.translate.onLangChange.subscribe(() => this.loadData());
    this.loadData();
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  private loadData(): void {
    this.isLoading = true;
    forkJoin({
      roles: this.departmentService.getAllRolesForDropdown(),
      departments: this.departmentService.getAllDepartmentsForDropdown()
    }).subscribe({
      next: ({ roles, departments }) => {
        this.departments = departments;
        this.allRoles = roles.map(role => this.toRow(role));
        this.applyFilter();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading roles', err);
        this.isLoading = false;
      }
    });
  }

  private toRow(role: DepartmentRole): RoleRow {
    return {
      id: role.id,
      name: (this.currentLang === 'ar' ? role.nameAr : role.nameEn) ?? role.name ?? '',
      description: (this.currentLang === 'ar' ? role.descriptionAr : role.descriptionEn) ?? role.description ?? '',
      departmentId: role.departmentId,
      departmentName: role.departmentId
        ? ((this.currentLang === 'ar' ? role.departmentNameAr : role.departmentNameEn) ?? role.departmentName ?? '')
        : '',
      isManagerRole: role.isManagerRole,
      raw: role
    };
  }

  private recomputeRoles(): void {
    this.roles = this.selectedDeptFilter
      ? this.allRoles.filter(r => r.departmentId === this.selectedDeptFilter)
      : this.allRoles;
  }

  applyFilter(): void {
    this.recomputeRoles();
    this.currentPage = 1;
  }

  openAddRole(): void {
    this.router.navigate([`/${this.currentLang}/d3/roles/add`]);
  }

  viewPermissions(role: RoleRow): void {
    this.router.navigate([this.currentLang, 'd3', 'roles', role.id]);
  }

  editRole(role: RoleRow): void {
    const ref = this.dialog.open(AddRoleDialogComponent, {
      width: '560px',
      maxWidth: '600px',
      maxHeight: '100vh',
      panelClass: 'role-dialog-panel',
      data: { departmentId: role.departmentId, role: role.raw, deptName: role.departmentName }
    });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const index = this.allRoles.findIndex(r => r.id === role.id);
      if (index !== -1) {
        this.allRoles[index] = this.toRow({ ...role.raw, ...result });
        this.recomputeRoles();
        if (this.currentPage > this.totalPages) {
          this.currentPage = this.totalPages;
        }
      }
    });
  }

  deleteRole(role: RoleRow): void {
    this.departmentService.getEmployeeCountForRole(role.id).subscribe({
      next: (count) => this.confirmDeleteRole(role, count),
      error: () => this.confirmDeleteRole(role, 0)
    });
  }

  private confirmDeleteRole(role: RoleRow, employeeCount: number): void {
    const dialogRef = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.translate.instant('d3.toast.deleteRoleTitle'),
        message: employeeCount > 0
          ? this.translate.instant('d3.toast.deleteRoleMessageWithEmployees', { count: employeeCount })
          : this.translate.instant('d3.toast.deleteRoleMessage')
      },
      panelClass: 'custom-confirm-dialog'
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deletingId = role.id;
      this.departmentService.deleteRole(role.id).subscribe({
        next: () => {
          this.deletingId = null;
          this.toastr.success(this.translate.instant('d3.toast.deleteRoleSuccess'));
          this.loadData();
        },
        error: (err) => {
          this.deletingId = null;
          this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.deleteError')));
        }
      });
    });
  }
}
