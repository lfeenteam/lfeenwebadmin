import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { DepartmentService } from '../../../services/department.service';
import { DepartmentManager, RolePermission } from '../../../interfaces/department.model';
import { PageTitleOverrideService } from '../../../services/page-title-override.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DeleteConfirmDialogComponent } from '../../team-management/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { forkJoin, Subscription } from 'rxjs';
import { extractApiErrorMessage } from '../../../utils/api-error.util';

@Component({
  selector: 'app-role-permissions',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, RouterModule, TranslateModule],
  templateUrl: './role-permissions.component.html',
  styleUrl: './role-permissions.component.scss'
})
export class RolePermissionsComponent implements OnInit, OnDestroy {
  private langSub!: Subscription;
  deptId: string | null = null;
  roleId: string | null = null;

  deptName = '';
  managers: DepartmentManager[] = [];
  employeeCount = 0;
  roleName = '';
  hasDepartmentContext = false;

  isLoading = true;
  permissions: RolePermission[] = [];
  deletingId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private dialog: MatDialog,
    private toastr: ToastrService,
    private pageTitleOverride: PageTitleOverrideService
  ) {
    this.deptId = this.route.snapshot.paramMap.get('id');
    this.roleId = this.route.snapshot.paramMap.get('roleId');
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  get backRoute(): string {
    return this.deptId
      ? `/${this.currentLang}/d3/permissions/${this.deptId}`
      : `/${this.currentLang}/d3/roles`;
  }

  ngOnInit(): void {
    this.langSub = this.translate.onLangChange.subscribe(() => this.loadData());
    this.loadData();
  }

  private loadData(): void {
    if (!this.roleId) return;
    this.isLoading = true;
    forkJoin({
      dept: this.deptId ? this.departmentService.getDepartmentById(this.deptId) : Promise.resolve(null),
      role: this.departmentService.getRoleById(this.roleId),
      permissions: this.departmentService.getRolePermissions(this.roleId)
    }).subscribe({
      next: ({ dept, role, permissions }) => {
        this.hasDepartmentContext = !!dept;
        if (dept) {
          this.deptName = dept.name
            ?? (this.currentLang === 'ar' ? dept.nameAr : dept.nameEn)
            ?? dept.nameAr
            ?? dept.nameEn
            ?? '';
          this.managers = dept.managers?.length
            ? dept.managers
            : (dept.managerFullName ? [{ id: '', fullName: dept.managerFullName, avatar: dept.managerAvatar }] : []);
          this.employeeCount = dept.employeeCount;
        } else {
          this.deptName = (this.currentLang === 'ar' ? role.departmentNameAr : role.departmentNameEn) ?? role.departmentName ?? '';
        }
        this.roleName = role.name
          ?? (this.currentLang === 'ar' ? role.nameAr : role.nameEn)
          ?? role.nameAr
          ?? role.nameEn
          ?? '';
        this.permissions = permissions;
        this.isLoading = false;
        this.pageTitleOverride.set(this.roleName);
      },
      error: () => { this.isLoading = false; }
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.pageTitleOverride.clear();
  }

  onToggleChange(perm: RolePermission, event: MatSlideToggleChange): void {
    if (!event.checked) {
      // Immediately revert the toggle to ON, wait for confirm
      event.source.checked = true;

      const dependents = this.permissions.filter(
        p => p.id !== perm.id && (p.impliedPermissionIds ?? []).includes(perm.id)
      );
      if (dependents.length > 0) {
        this.toastr.warning(
          this.translate.instant('d3.permissions.dependencyBlocked', {
            names: dependents.map(d => d.name).join('، ')
          })
        );
        return;
      }

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
        error: (err) => {
          this.deletingId = null;
          this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.removePermError')));
        }
      });
    });
  }
}
