import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { DepartmentService, RolePermission } from '../../../services/department.service';

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
export class AddRoleComponent implements OnInit {
  deptId: string | null = null;
  deptName = '';
  employeeCount = 0;

  roleForm: FormGroup;
  showNameSecondary = false;
  showDescSecondary = false;

  permissions: PermissionRow[] = [];
  isLoadingPerms = true;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private toastr: ToastrService
  ) {
    this.deptId = this.route.snapshot.paramMap.get('id');
    this.roleForm = this.fb.group({
      nameAr: ['', [Validators.required, Validators.minLength(2)]],
      nameEn: [''],
      descriptionAr: [''],
      descriptionEn: ['']
    });
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  ngOnInit(): void {
    forkJoin({
      perms: this.departmentService.getPermissions(100),
      ...(this.deptId ? { dept: this.departmentService.getDepartmentById(this.deptId) } : {})
    }).subscribe({
      next: (res: any) => {
        this.permissions = (res.perms as RolePermission[]).map(p => ({ ...p, selected: false }));
        if (res.dept) {
          this.deptName = res.dept.nameAr ?? res.dept.name ?? '';
          this.employeeCount = res.dept.employeeCount;
        }
        this.isLoadingPerms = false;
      },
      error: () => { this.isLoadingPerms = false; }
    });
  }

  get selectedCount(): number {
    return this.permissions.filter(p => p.selected).length;
  }

  togglePermission(perm: PermissionRow, checked: boolean): void {
    perm.selected = checked;
  }

  save(): void {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      this.toastr.warning(
        this.currentLang === 'ar' ? 'يرجى تعبئة الحقول المطلوبة' : 'Please fill required fields'
      );
      return;
    }

    this.isSubmitting = true;
    const v = this.roleForm.value;

    this.departmentService.createRole({
      nameAr: v.nameAr,
      nameEn: v.nameEn || v.nameAr,
      descriptionAr: v.descriptionAr,
      descriptionEn: v.descriptionEn || v.descriptionAr,
      departmentId: this.deptId!
    }).pipe(
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
          this.currentLang === 'ar' ? 'تم إضافة الدور بنجاح' : 'Role added successfully'
        );
        this.router.navigate([`/${this.currentLang}/d3/permissions/${this.deptId}`]);
      },
      error: () => {
        this.isSubmitting = false;
        this.toastr.error(
          this.currentLang === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Error saving role'
        );
      }
    });
  }

  cancel(): void {
    this.router.navigate([`/${this.currentLang}/d3/permissions/${this.deptId}`]);
  }
}
