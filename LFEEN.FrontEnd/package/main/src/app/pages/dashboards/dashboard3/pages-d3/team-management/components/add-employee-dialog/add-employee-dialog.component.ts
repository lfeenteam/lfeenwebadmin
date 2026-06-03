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
import { DepartmentService, DepartmentRole } from '../../department.service';

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
  tempPassword = '';
  isDropdownOpen = false;
  selectedRole: { nameAr: string; nameEn: string } | null = null;
  serverErrors: Record<string, string> = {};

  private readonly fieldMap: Record<string, string> = {
    'request.email': 'email',
    'request.fullname': 'fullName',
    'request.phonenumber': 'phoneNumber',
    'request.roleid': 'roleId',
    'request.password': 'password',
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
    this.tempPassword = this.data.employee ? '********' : this.generateTempPassword();
    this.employeeForm = this.fb.group({
      fullName: [this.data.employee?.fullName || '', [Validators.required, Validators.minLength(2)]],
      email: [this.data.employee?.email || '', [Validators.required, Validators.email]],
      phoneNumber: [this.data.employee?.phoneNumber || '', [Validators.required, Validators.pattern(/^[+\d]+$/)]],
      roleId: [this.data.employee?.roles?.[0]?.roleId || '', Validators.required],
      password: [this.tempPassword, this.data.employee ? [] : [Validators.required, Validators.pattern(/(?=.*[A-Z])/)]]
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
    console.log('Selecting role:', role);
    this.selectedRole = role;
    const roleIdValue = role.id;
    this.employeeForm.get('roleId')?.setValue(roleIdValue);
    this.isDropdownOpen = false;
    this.cdr.detectChanges();
  }

  loadRoles(): void {
    this.departmentService.getDepartmentRoles(this.data.departmentId).subscribe({
      next: (roles) => {
        console.log('Loaded Roles:', roles);
        this.roles = roles;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error loading roles', err)
    });
  }

  generateTempPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'Lafin-2024-';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  copyPassword(): void {
    const password = this.employeeForm.get('password')?.value;
    if (!password) return;
    navigator.clipboard.writeText(password).then(() => {
      this.toastr.success(
        this.currentLang === 'ar' ? 'تم نسخ كلمة المرور بنجاح' : 'Password copied successfully'
      );
    });
  }

  getSelectedRoleName(): string {
    if (!this.selectedRole) return '';
    return this.currentLang === 'ar' ? this.selectedRole.nameAr : this.selectedRole.nameEn;
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

      if (!this.data.employee) {
        (submissionData as any).password = formData.password;
      }

      const request = this.data.employee 
        ? this.departmentService.updateEmployee(this.data.departmentId, this.data.employee.userId, submissionData)
        : this.departmentService.addEmployee(this.data.departmentId, submissionData);

      this.serverErrors = {};
      request.subscribe({
        next: () => {
          this.toastr.success(
            this.currentLang === 'ar'
              ? (this.data.employee ? 'تم تحديث بيانات الموظف بنجاح' : 'تم إضافة الموظف بنجاح')
              : (this.data.employee ? 'Employee updated successfully' : 'Employee added successfully')
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
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
