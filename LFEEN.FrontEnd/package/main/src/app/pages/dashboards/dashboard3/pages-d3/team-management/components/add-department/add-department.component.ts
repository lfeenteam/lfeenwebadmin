import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { switchMap } from 'rxjs/operators';
import { forkJoin, of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { DepartmentService } from '../../../../services/department.service';
import { LoginService } from '../../../../services/login/login.service';

interface PermissionItem {
  key: string;
  icon: string;
  nameAr: string;
  nameEn: string;
  enabled: boolean;
}

@Component({
  selector: 'app-add-department',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './add-department.component.html',
  styleUrl: './add-department.component.scss'
})
export class AddDepartmentComponent {
  form: FormGroup;
  isSubmitting = false;

  showDeptNameSecondary = false;
  showDeptDescSecondary = false;

  permissions: PermissionItem[] = [
    { key: 'dashboard',    icon: 'layout-grid',    nameAr: 'لوحة التحكم',    nameEn: 'Dashboard',           enabled: true  },
    { key: 'buildings',    icon: 'building',        nameAr: 'إدارة المباني',  nameEn: 'Building Management', enabled: true  },
    { key: 'units',        icon: 'home',            nameAr: 'إدارة الوحدات', nameEn: 'Unit Management',     enabled: true  },
    { key: 'reservations', icon: 'calendar-event',  nameAr: 'الحجوزات',       nameEn: 'Reservations',        enabled: true  },
    { key: 'guests',       icon: 'users',           nameAr: 'الضيوف',         nameEn: 'Guests',              enabled: false },
    { key: 'hosts',        icon: 'user-check',      nameAr: 'المضيفون',       nameEn: 'Hosts',               enabled: false },
    { key: 'revenue',      icon: 'chart-bar',       nameAr: 'الإيرادات',      nameEn: 'Revenue',             enabled: false },
    { key: 'reports',      icon: 'file-analytics',  nameAr: 'التقارير',       nameEn: 'Reports',             enabled: false },
    { key: 'complaints',   icon: 'message-dots',    nameAr: 'الشكاوى',        nameEn: 'Complaints',          enabled: false },
    { key: 'cities',       icon: 'map-pin',         nameAr: 'المدن',          nameEn: 'Cities',              enabled: false },
    { key: 'team',         icon: 'users-group',     nameAr: 'إدارة الفرق',    nameEn: 'Team Management',     enabled: false },
    { key: 'settings',     icon: 'settings',        nameAr: 'الإعدادات',      nameEn: 'Settings',            enabled: false },
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    private departmentService: DepartmentService,
    private loginService: LoginService
  ) {
    this.form = this.fb.group({
      deptNameAr: ['', [Validators.required, Validators.minLength(2)]],
      deptNameEn: [''],
      deptCode: ['', Validators.required],
      deptDescriptionAr: [''],
      deptDescriptionEn: [''],
    });
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  enableAll(): void {
    this.permissions.forEach(p => p.enabled = true);
  }

  disableAll(): void {
    this.permissions.forEach(p => p.enabled = false);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastr.warning(
        this.translate.instant('d3.toast.fillRequired')
      );
      return;
    }

    this.isSubmitting = true;
    const v = this.form.value;
    const managerId = this.loginService.currentUser()?.userId ?? '';
    const enabledPerms = this.permissions.filter(p => p.enabled);

    this.departmentService.createDepartment({
      nameAr: v.deptNameAr,
      nameEn: v.deptNameEn || v.deptNameAr,
      code: v.deptCode,
      descriptionAr: v.deptDescriptionAr,
      descriptionEn: v.deptDescriptionEn || v.deptDescriptionAr,
      managerId
    }).pipe(
      switchMap(dept => {
        if (enabledPerms.length === 0) return of(null);
        return forkJoin(
          enabledPerms.map(perm =>
            this.departmentService.createRole({
              nameAr: perm.nameAr,
              nameEn: perm.nameEn,
              descriptionAr: '',
              descriptionEn: '',
              departmentId: dept.id
            })
          )
        );
      })
    ).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.toastr.success(
          this.translate.instant('d3.toast.addDeptSuccess')
        );
        this.router.navigate(['../'], { relativeTo: this.route });
      },
      error: () => {
        this.isSubmitting = false;
        this.toastr.error(
          this.translate.instant('d3.toast.errorOp')
        );
        this.cdr.detectChanges();
      }
    });
  }

  cancel(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
