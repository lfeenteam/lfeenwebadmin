import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { forkJoin, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { DepartmentService } from '../../../services/department.service';
import { Department, RolePayload, RolePermission } from '../../../interfaces/department.model';
import { extractApiErrorMessage } from '../../../utils/api-error.util';
import { PageBreadcrumbTrailService } from '../../../services/page-breadcrumb-trail.service';

interface PermissionRow extends RolePermission {
  selected: boolean;
}

@Component({
  selector: 'app-add-role',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, ReactiveFormsModule, RouterModule, TranslateModule],
  templateUrl: './add-role.component.html',
  styleUrl: './add-role.component.scss'
})
export class AddRoleComponent implements OnInit, OnDestroy {
  private langSub!: Subscription;
  deptId: string | null = null;
  deptName = '';
  deptEnglishName = '';
  employeeCount = 0;

  roleForm: FormGroup;
  showNameSecondary = false;
  showDescSecondary = false;

  permissions: PermissionRow[] = [];
  isLoadingPerms = true;
  isSubmitting = false;

  departments: Department[] = [];

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private toastr: ToastrService,
    private pageBreadcrumbTrail: PageBreadcrumbTrailService
  ) {
    this.deptId = this.route.snapshot.paramMap.get('id');
    this.roleForm = this.fb.group({
      nameAr: [''],
      nameEn: [''],
      descriptionAr: [''],
      descriptionEn: [''],
      isManagerRole: [false],
      departmentId: ['']
    });
  }

  private updateValidators(): void {
    const nameAr = this.roleForm.get('nameAr')!;
    const nameEn = this.roleForm.get('nameEn')!;
    if (this.currentLang === 'ar') {
      nameAr.setValidators([Validators.required, Validators.minLength(2)]);
      nameEn.clearValidators();
    } else {
      nameEn.setValidators([Validators.required, Validators.minLength(2)]);
      nameAr.clearValidators();
    }
    nameAr.updateValueAndValidity();
    nameEn.updateValueAndValidity();
  }

  ngOnInit(): void {
    this.updateValidators();
    this.langSub = this.translate.onLangChange.subscribe(() => {
      this.updateValidators();
      this.loadData();
    });

    this.loadData();
  }

  private loadData(): void {
    const selectedIds = new Set(
      this.permissions.filter(permission => permission.selected).map(permission => permission.id)
    );

    this.isLoadingPerms = true;
    forkJoin({
      perms: this.departmentService.getPermissions(500),
      ...(this.deptId
        ? { dept: this.departmentService.getDepartmentById(this.deptId) }
        : { allDepts: this.departmentService.getAllDepartmentsForDropdown() })
    }).subscribe({
      next: (res: any) => {
        this.permissions = (res.perms as RolePermission[]).map(permission => ({
          ...permission,
          selected: selectedIds.has(permission.id)
        }));
        if (res.dept) {
          this.deptName = res.dept.nameAr ?? res.dept.name ?? '';
          this.deptEnglishName = res.dept.nameEn ?? res.dept.name ?? '';
          this.employeeCount = res.dept.employeeCount;
          const lang = this.currentLang;
          this.pageBreadcrumbTrail.set([
            {
              label: lang === 'ar' ? this.deptName : this.deptEnglishName,
              translate: false,
              route: ['/', lang, 'd3', 'permissions', this.deptId ?? '']
            }
          ]);
        }
        if (res.allDepts) {
          this.departments = res.allDepts;
        }
        this.isLoadingPerms = false;
      },
      error: () => { this.isLoadingPerms = false; }
    });
  }

  get selectedCount(): number {
    return this.permissions.filter(p => p.selected).length;
  }

  private impliedIdsOf(permId: string): Set<string> {
    const result = new Set<string>();
    const queue = [permId];
    while (queue.length) {
      const current = this.permissions.find(p => p.id === queue.shift());
      for (const impliedId of current?.impliedPermissionIds ?? []) {
        if (!result.has(impliedId)) {
          result.add(impliedId);
          queue.push(impliedId);
        }
      }
    }
    return result;
  }

  togglePermission(perm: PermissionRow, checked: boolean): void {
    if (checked) {
      perm.selected = true;
      this.impliedIdsOf(perm.id).forEach(id => {
        const implied = this.permissions.find(p => p.id === id);
        if (implied) implied.selected = true;
      });
      return;
    }

    const dependents = this.permissions.filter(
      p => p.selected && p.id !== perm.id && this.impliedIdsOf(p.id).has(perm.id)
    );
    if (dependents.length > 0) {
      this.toastr.warning(
        this.translate.instant('d3.addRolePage.dependencyBlocked', {
          names: dependents.map(d => d.name).join('، ')
        })
      );
      return;
    }
    perm.selected = false;
  }

  private get backRoute(): string {
    return this.deptId
      ? `/${this.currentLang}/d3/permissions/${this.deptId}`
      : `/${this.currentLang}/d3/roles`;
  }

  save(): void {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      this.toastr.warning(
        this.translate.instant('d3.toast.fillRequired')
      );
      return;
    }

    this.isSubmitting = true;
    const v = this.roleForm.value;

    const payload: RolePayload = {
      nameAr: v.nameAr || v.nameEn,
      nameEn: v.nameEn || v.nameAr,
      descriptionAr: v.descriptionAr || v.descriptionEn,
      descriptionEn: v.descriptionEn || v.descriptionAr,
      isManagerRole: v.isManagerRole,
      ...((this.deptId || v.departmentId) ? { departmentId: this.deptId || v.departmentId } : {})
    };

    this.departmentService.createRole(payload).pipe(
      switchMap((newRole: any) => {
        const selectedIds = this.permissions.filter(p => p.selected).map(p => p.id);
        if (selectedIds.length === 0) {
          return new Promise<void>(resolve => resolve()) as any;
        }
        return this.departmentService.bulkAssignPermissions(newRole.id, selectedIds);
      })
    ).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.toastr.success(
          this.translate.instant('d3.toast.addRoleSuccess')
        );
        this.router.navigate([this.backRoute]);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.saveError')));
      }
    });
  }

  cancel(): void {
    this.router.navigate([this.backRoute]);
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.pageBreadcrumbTrail.clear();
  }
}
