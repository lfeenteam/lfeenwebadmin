import { Component, Inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DepartmentService } from '../../../../services/department.service';
import { DepartmentRole } from '../../../../interfaces/department.model';

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
    @Inject(MAT_DIALOG_DATA) public data: { departmentId: string; role?: DepartmentRole; deptName?: string }
  ) {
    const lang = this.translate.currentLang || 'ar';
    const r = this.data.role;
    this.roleForm = this.fb.group({
      nameAr: [r?.nameAr || (lang === 'ar' ? r?.name : '') || '', [Validators.required, Validators.minLength(2)]],
      nameEn: [r?.nameEn || (lang === 'en' ? r?.name : '') || ''],
      descriptionAr: [r?.descriptionAr || (lang === 'ar' ? r?.description : '') || ''],
      descriptionEn: [r?.descriptionEn || (lang === 'en' ? r?.description : '') || '']
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
            descriptionEn: role.descriptionEn || (lang === 'en' ? role.description : '') || ''
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
        this.currentLang === 'ar' ? 'يرجى تعبئة الحقول المطلوبة' : 'Please fill required fields'
      );
      return;
    }

    this.isSubmitting = true;
    const v = this.roleForm.value;

    const request = this.data.role
      ? this.departmentService.updateRole(this.data.role.id, {
          nameAr: v.nameAr,
          nameEn: v.nameEn,
          descriptionAr: v.descriptionAr,
          descriptionEn: v.descriptionEn,
          departmentId: this.data.departmentId
        })
      : this.departmentService.createRole({
          nameAr: v.nameAr,
          nameEn: v.nameEn || v.nameAr,
          descriptionAr: v.descriptionAr,
          descriptionEn: v.descriptionEn || v.descriptionAr,
          departmentId: this.data.departmentId
        });

    request.subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.toastr.success(
          this.currentLang === 'ar'
            ? (this.data.role ? 'تم تعديل الدور بنجاح' : 'تم إضافة الدور بنجاح')
            : (this.data.role ? 'Role updated successfully' : 'Role added successfully')
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
        this.toastr.error(
          this.currentLang === 'ar' ? 'حدث خطأ أثناء العملية' : 'Error during operation'
        );
        this.cdr.detectChanges();
      }
    });
  }
}
