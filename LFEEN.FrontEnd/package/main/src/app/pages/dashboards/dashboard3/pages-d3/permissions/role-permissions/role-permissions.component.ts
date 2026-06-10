import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { DepartmentService } from '../../../services/department.service';
import { RolePermission } from '../../../interfaces/department.model';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DeleteConfirmDialogComponent } from '../../team-management/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-role-permissions',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, RouterModule, TranslateModule],
  templateUrl: './role-permissions.component.html',
  styleUrl: './role-permissions.component.scss'
})
export class RolePermissionsComponent implements OnInit {
  deptId: string | null = null;
  roleId: string | null = null;

  deptName = '';
  deptEnglishName = '';
  manager = '';
  employeeCount = 0;
  roleName = '';

  isLoading = true;
  permissions: RolePermission[] = [];
  deletingId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private dialog: MatDialog,
    private toastr: ToastrService
  ) {
    this.deptId = this.route.snapshot.paramMap.get('id');
    this.roleId = this.route.snapshot.paramMap.get('roleId');
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  ngOnInit(): void {
    if (!this.deptId || !this.roleId) return;

    forkJoin({
      dept: this.departmentService.getDepartmentById(this.deptId),
      role: this.departmentService.getRoleById(this.roleId),
      permissions: this.departmentService.getRolePermissions(this.roleId)
    }).subscribe({
      next: ({ dept, role, permissions }) => {
        this.deptName = dept.nameAr ?? dept.name ?? '';
        this.deptEnglishName = dept.nameEn ?? dept.name ?? '';
        this.manager = dept.managerFullName || '---';
        this.employeeCount = dept.employeeCount;
        this.roleName = (this.currentLang === 'ar' ? role.nameAr : role.nameEn) ?? role.name ?? '';
        this.permissions = permissions;
        this.isLoading = false;
      },
      error: () => { this.isLoading = false; }
    });
  }

  onToggleChange(perm: RolePermission, event: MatSlideToggleChange): void {
    if (!event.checked) {
      // Immediately revert the toggle to ON, wait for confirm
      event.source.checked = true;
      this.confirmRemove(perm);
    }
  }

  private confirmRemove(perm: RolePermission): void {
    const ref = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '440px',
      panelClass: 'custom-confirm-dialog',
      data: {
        title: this.translate.instant('d3.toast.removePermTitle'),
        message: this.translate.instant('d3.toast.removePermMessage', { permName: perm.name })
      }
    });

    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deletingId = perm.id;
      this.departmentService.deleteRolePermission(this.roleId!, perm.id).subscribe({
        next: () => {
          this.permissions = this.permissions.filter(p => p.id !== perm.id);
          this.deletingId = null;
          this.toastr.success(
            this.translate.instant('d3.toast.removePermSuccess')
          );
        },
        error: () => {
          this.deletingId = null;
          this.toastr.error(
            this.translate.instant('d3.toast.removePermError')
          );
        }
      });
    });
  }
}
