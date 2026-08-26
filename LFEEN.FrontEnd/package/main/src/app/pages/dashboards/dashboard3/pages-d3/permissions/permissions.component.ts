import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, combineLatest, forkJoin, of } from 'rxjs';
import { catchError, startWith, switchMap } from 'rxjs/operators';
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
import { resolveBilingualText } from '../../utils/bilingual.util';

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
  private dataSub!: Subscription;
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
    this.dataSub = combineLatest([
      this.route.paramMap,
      this.translate.onLangChange.pipe(startWith(null))
    ]).pipe(
      switchMap(([params]) => {
        this.deptId = params.get('id');
        if (!this.deptId) return of(null);

        this.isLoading = true;
        const id = this.deptId;
        return forkJoin({
          department: this.departmentService.getDepartmentById(id).pipe(
            catchError(err => { console.error('Error loading department', err); return of(null); })
          ),
          roles: this.departmentService.getDepartmentRoles(id).pipe(
            catchError(err => { console.error('Error loading roles', err); return of(null); })
          )
        });
      })
    ).subscribe(result => {
      if (!result) { this.isLoading = false; return; }

      if (result.department) {
        const dept = result.department;
        this.deptName = resolveBilingualText('ar', dept.nameAr, dept.nameEn, dept.name);
        this.deptEnglishName = resolveBilingualText('en', dept.nameAr, dept.nameEn, dept.name);
        this.managers = dept.managers?.length
          ? dept.managers
          : (dept.managerFullName ? [{ id: '', fullName: dept.managerFullName, avatar: dept.managerAvatar }] : []);
        this.employeeCount = dept.employeeCount;
        this.pageTitleOverride.set(this.currentLang === 'ar' ? this.deptName : this.deptEnglishName);
      }

      if (result.roles) {
        this.roles = result.roles.map(role => this.mapRoleRow(role));
      }

      this.isLoading = false;
    });
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
    this.pageTitleOverride.clear();
  }

  private mapRoleRow(role: DepartmentRole): RoleRow {
    return {
      id: role.id,
      name: resolveBilingualText(this.currentLang, role.nameAr, role.nameEn, role.name),
      description: resolveBilingualText(this.currentLang, role.descriptionAr, role.descriptionEn, role.description),
      icon: 'user-circle',
      isManagerRole: role.isManagerRole,
      raw: role
    };
  }

  private refreshRoles(): void {
    if (!this.deptId) return;
    this.departmentService.getDepartmentRoles(this.deptId).subscribe({
      next: (roles) => { this.roles = roles.map(role => this.mapRoleRow(role)); },
      error: (err) => console.error('Error loading roles', err)
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
      const roleIndex = this.roles.findIndex(r => r.id === role.id);
      if (roleIndex !== -1) {
        this.roles[roleIndex] = this.mapRoleRow({ ...role.raw, ...result });
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
          this.refreshRoles();
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
