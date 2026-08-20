import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { DepartmentService } from '../../services/department.service';
import { DepartmentManager, DepartmentRole } from '../../interfaces/department.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AddRoleDialogComponent } from './components/add-role-dialog/add-role-dialog.component';
import { DeleteConfirmDialogComponent } from '../team-management/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { PageTitleOverrideService } from '../../services/page-title-override.service';

interface RoleRow {
  id: string;
  name: string;
  description: string;
  icon: string;
  isManagerRole: boolean;
  raw: DepartmentRole;
}

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss'
})
export class PermissionsComponent implements OnInit, OnDestroy {
  private langSub!: Subscription;
  private routeSub!: Subscription;
  deptId: string | null = null;
  deptName = '';
  deptEnglishName = '';
  deptDescAr = '';
  deptDescEn = '';
  managers: DepartmentManager[] = [];
  employeeCount = 0;
  isLoading = true;
  deletingId: string | null = null;

  roles: RoleRow[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private dialog: MatDialog,
    private toastr: ToastrService,
    private pageTitleOverride: PageTitleOverrideService
  ) {}

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  ngOnInit(): void {
    this.langSub = this.translate.onLangChange.subscribe(() => {
      if (this.deptId) {
        this.loadDepartment(this.deptId);
        this.loadRoles(this.deptId);
      }
    });

    this.routeSub = this.route.paramMap.subscribe(params => {
      this.deptId = params.get('id');
      if (this.deptId) {
        this.loadDepartment(this.deptId);
        this.loadRoles(this.deptId);
      }
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.pageTitleOverride.clear();
  }

  private loadDepartment(id: string): void {
    this.departmentService.getDepartmentById(id).subscribe({
      next: (dept) => {
        this.deptName = dept.nameAr ?? dept.name ?? '';
        this.deptEnglishName = dept.nameEn ?? dept.name ?? '';
        this.managers = dept.managers?.length
          ? dept.managers
          : (dept.managerFullName ? [{ id: '', fullName: dept.managerFullName, avatar: dept.managerAvatar }] : []);
        this.employeeCount = dept.employeeCount;
        this.pageTitleOverride.set(this.currentLang === 'ar' ? this.deptName : this.deptEnglishName);
      },
      error: (err) => console.error('Error loading department', err)
    });
  }

  private loadRoles(id: string): void {
    this.isLoading = true;
    this.departmentService.getDepartmentRoles(id).subscribe({
      next: (roles) => {
        this.roles = roles.map(role => ({
          id: role.id,
          name: (this.currentLang === 'ar' ? role.nameAr : role.nameEn) ?? role.name ?? '',
          description: (this.currentLang === 'ar' ? role.descriptionAr : role.descriptionEn) ?? role.description ?? '',
          icon: 'user-circle',
          isManagerRole: role.isManagerRole,
          raw: role
        }));
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading roles', err);
        this.isLoading = false;
      }
    });
  }

openAddRoleDialog(): void {
  this.router.navigate([`/${this.translate.currentLang || 'ar'}/d3/permissions/${this.deptId}/add-role`]);
}

viewPermissions(role: RoleRow): void {
  const lang = this.translate.currentLang || 'ar';
  this.router.navigate([lang, 'd3', 'permissions', this.deptId, 'role', role.id]);
}

editRole(role: RoleRow): void {
  const ref = this.dialog.open(AddRoleDialogComponent, {
    width: '560px',
    maxWidth: '600px',
    maxHeight: '100vh',
    panelClass: 'role-dialog-panel',
    data: { departmentId: this.deptId, role: role.raw, deptName: this.deptName }
  });
  ref.afterClosed().subscribe(result => {
    if (result) {
      console.log('Edit result:', result);
      
      const roleIndex = this.roles.findIndex(r => r.id === role.id);
      if (roleIndex !== -1) {
        this.roles[roleIndex].name = (this.currentLang === 'ar' ? result.nameAr : result.nameEn) ?? result.name ?? '';
        this.roles[roleIndex].description = (this.currentLang === 'ar' ? result.descriptionAr : result.descriptionEn) ?? result.description ?? '';
        this.roles[roleIndex].isManagerRole = result.isManagerRole ?? false;
        this.roles[roleIndex].raw = result;
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
          this.toastr.success(
            this.translate.instant('d3.toast.deleteRoleSuccess')
          );
          if (this.deptId) this.loadRoles(this.deptId);
        },
        error: () => {
          this.deletingId = null;
          this.toastr.error(
            this.translate.instant('d3.toast.deleteError')
          );
        }
      });
    });
  }
}
