import { Component, Inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { DepartmentService } from '../../../../services/department.service';
import { DepartmentRole } from '../../../../interfaces/department.model';

@Component({
  selector: 'app-add-employee-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    TablerIconsModule,
    TranslateModule,
    ReactiveFormsModule
  ],
  templateUrl: './add-employee-dialog.component.html',
  styleUrl: './add-employee-dialog.component.scss'
})
export class AddEmployeeDialogComponent implements OnInit {
  employeeForm: FormGroup;
  roles: DepartmentRole[] = [];
  isDropdownOpen = false;
  isSubmitting = false;
  selectedRole: { name?: string; nameAr?: string; nameEn?: string } | null = null;
  serverErrors: Record<string, string> = {};

  private readonly fieldMap: Record<string, string> = {
    'request.email': 'email',
    'request.fullname': 'fullName',
    'request.phonenumber': 'phoneNumber',
    'request.roleid': 'roleId',
  };

  private readonly errorMessageMap: Record<string, string> = {
    'email already exists.': 'البريد الإلكتروني مستخدم بالفعل.',
    'phone number already exists.': 'رقم الهاتف مستخدم بالفعل.',
    'user not found.': 'المستخدم غير موجود.',
    'invalid password.': 'كلمة المرور غير صحيحة.',
    'role not found.': 'الدور الوظيفي غير موجود.',
    'validation failed.': 'فشل التحقق من البيانات.',
  };

  translateError(message: string): string {
    if (this.currentLang === 'ar') {
      return this.errorMessageMap[message.toLowerCase()] ?? message;
    }
    return message;
  }

  constructor(
    private fb: FormBuilder,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    public dialogRef: MatDialogRef<AddEmployeeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { departmentId: string, employee?: any }
  ) {
    this.employeeForm = this.fb.group({
      fullName: [this.data.employee?.fullName || '', [Validators.required, Validators.minLength(2)]],
      email: [this.data.employee?.email || '', [Validators.required, Validators.email]],
      phoneNumber: [this.data.employee?.phoneNumber || '', [Validators.required, Validators.pattern(/^[+\d]+$/)]],
      roleId: [this.data.employee?.roles?.[0]?.roleId || '', Validators.required],
    });

    if (this.data.employee) {
      this.selectedRole = this.data.employee.roles?.[0];
    }
  }

  ngOnInit(): void {
    this.loadRoles();
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  selectRole(role: any): void {
    this.selectedRole = role;
    this.employeeForm.get('roleId')?.setValue(role.id);
    this.isDropdownOpen = false;
    this.cdr.detectChanges();
  }

  loadRoles(): void {
    this.departmentService.getDepartmentRoles(this.data.departmentId).subscribe({
      next: (roles) => {
        this.roles = roles;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error loading roles', err)
    });
  }

  getSelectedRoleName(): string {
    if (!this.selectedRole) return '';
    return this.selectedRole.nameAr
      || this.selectedRole.nameEn
      || this.selectedRole.name
      || '';
  }

  saveEmployee(): void {
    if (this.employeeForm.valid) {
      const formData = this.employeeForm.value;
      const submissionData = {
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        roleIds: [formData.roleId]
      };

      const request = this.data.employee
        ? this.departmentService.updateEmployee(this.data.departmentId, this.data.employee.userId, submissionData)
        : this.departmentService.addEmployee(this.data.departmentId, submissionData);

      this.serverErrors = {};
      this.isSubmitting = true;

      request.subscribe({
        next: () => {
          this.isSubmitting = false;
          this.toastr.success(
            this.currentLang === 'ar'
              ? (this.data.employee ? 'تم تحديث بيانات الموظف بنجاح' : 'تم إضافة الموظف بنجاح')
              : (this.data.employee ? 'Employee updated successfully' : 'Employee added successfully')
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.isSubmitting = false;
          const apiErrors: { field: string; message: string }[] = err?.error?.errors || [];
          if (apiErrors.length) {
            apiErrors.forEach(e => {
              const formField = this.fieldMap[e.field.toLowerCase()] || e.field;
              this.serverErrors[formField] = this.translateError(e.message);
            });
            this.cdr.detectChanges();
          } else {
            this.toastr.error(
              this.currentLang === 'ar' ? 'حدث خطأ أثناء العملية' : 'Error during operation'
            );
          }
        }
      });
    } else {
      this.employeeForm.markAllAsTouched();
      this.cdr.detectChanges();
      this.toastr.warning(
        this.currentLang === 'ar' ? 'يرجى تعبئة جميع الحقول المطلوبة' : 'Please fill in all required fields'
      );
    }
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }
}
