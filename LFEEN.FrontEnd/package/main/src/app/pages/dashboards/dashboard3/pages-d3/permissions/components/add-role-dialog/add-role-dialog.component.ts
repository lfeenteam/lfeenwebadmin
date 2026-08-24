import { Component, Inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DepartmentService } from '../../../../services/department.service';
import { DepartmentRole, RolePayload } from '../../../../interfaces/department.model';
import { extractApiErrorMessage } from '../../../../utils/api-error.util';

@Component({
  selector: 'app-add-role-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './add-role-dialog.component.html',
  styleUrl: './add-role-dialog.component.scss'
})
export class AddRoleDialogComponent implements OnInit {
  roleForm: FormGroup;
  isSubmitting = false;
  showNameSecondary = false;
  showDescSecondary = false;

  private get hasSecondaryName(): boolean {
    const r = this.data.role;
    if (!r) return false;
    // لو فيه قيمتين مختلفتين للعربي والانجليزي افتح الفيلدين تلقائياً
    return !!(r.nameEn && r.nameAr && r.nameEn !== r.nameAr);
  }

  private get hasSecondaryDesc(): boolean {
    const r = this.data.role;
    if (!r) return false;
    return !!(r.descriptionEn && r.descriptionAr && r.descriptionEn !== r.descriptionAr);
  }

  constructor(
    private fb: FormBuilder,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    public dialogRef: MatDialogRef<AddRoleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { departmentId?: string | null; role?: DepartmentRole; deptName?: string }
  ) {
    const lang = this.translate.currentLang || 'ar';
    const r = this.data.role;
    this.roleForm = this.fb.group({
      nameAr: [r?.nameAr || (lang === 'ar' ? r?.name : '') || '', [Validators.required, Validators.minLength(2)]],
      nameEn: [r?.nameEn || (lang === 'en' ? r?.name : '') || ''],
      descriptionAr: [r?.descriptionAr || (lang === 'ar' ? r?.description : '') || ''],
      descriptionEn: [r?.descriptionEn || (lang === 'en' ? r?.description : '') || ''],
      isManagerRole: [r?.isManagerRole ?? false]
    });

    this.showNameSecondary = this.hasSecondaryName;
    this.showDescSecondary = this.hasSecondaryDesc;
  }

  ngOnInit(): void {
    if (this.data.role?.id) {
      this.departmentService.getRoleById(this.data.role.id).subscribe({
        next: (role) => {
          const lang = this.currentLang;
          this.roleForm.patchValue({
            nameAr: role.nameAr || (lang === 'ar' ? role.name : '') || '',
            nameEn: role.nameEn || (lang === 'en' ? role.name : '') || '',
            descriptionAr: role.descriptionAr || (lang === 'ar' ? role.description : '') || '',
            descriptionEn: role.descriptionEn || (lang === 'en' ? role.description : '') || '',
            isManagerRole: role.isManagerRole
          });
          this.showNameSecondary = !!(role.nameEn && role.nameAr && role.nameEn !== role.nameAr);
          this.showDescSecondary = !!(role.descriptionEn && role.descriptionAr && role.descriptionEn !== role.descriptionAr);
          this.cdr.detectChanges();
        },
        error: () => {}
      });
    }
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  save(): void {
    if (this.roleForm.invalid) {
      this.roleForm.markAllAsTouched();
      this.cdr.detectChanges();
      this.toastr.warning(
        this.translate.instant('d3.toast.fillRequired')
      );
      return;
    }

    this.isSubmitting = true;
    const v = this.roleForm.value;

    const payload: RolePayload = {
      nameAr: v.nameAr,
      nameEn: v.nameEn || v.nameAr,
      descriptionAr: v.descriptionAr,
      descriptionEn: v.descriptionEn || v.descriptionAr,
      isManagerRole: v.isManagerRole,
      ...(this.data.departmentId ? { departmentId: this.data.departmentId } : {})
    };

    const request = this.data.role
      ? this.departmentService.updateRole(this.data.role.id, payload)
      : this.departmentService.createRole(payload);

    request.subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.toastr.success(
          this.translate.instant(this.data.role ? 'd3.toast.editRoleSuccess' : 'd3.toast.addRoleSuccess')
        );
        // بعتت البيانات المحدثة للـ parent component
        const updatedData = {
          ...this.data.role,
          ...v,
          id: this.data.role?.id || response?.id
        };
        console.log('Dialog closing with data:', updatedData);
        this.dialogRef.close(updatedData);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.errorOp')));
        this.cdr.detectChanges();
      }
    });
  }
}
