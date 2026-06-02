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
import { DepartmentService, EmployeeRole } from '../../department.service';

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
  roles: EmployeeRole[] = [];
  tempPassword = '';
  isDropdownOpen = false;
  selectedRole: EmployeeRole | null = null;

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
      fullName: [this.data.employee?.fullName || '', Validators.required],
      email: [this.data.employee?.email || '', [Validators.required, Validators.email]],
      phoneNumber: [this.data.employee?.phoneNumber || '', Validators.required],
      roleId: [this.data.employee?.roles?.[0]?.roleId || '', Validators.required],
      password: [this.tempPassword]
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
    this.employeeForm.get('roleId')?.setValue(role.roleId);
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
    
    const el = document.createElement('textarea');
    el.value = password;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);

    this.toastr.success(
      this.currentLang === 'ar' ? 'تم نسخ كلمة المرور بنجاح' : 'Password copied successfully'
    );
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

      request.subscribe({
        next: (res) => {
          this.toastr.success(
            this.currentLang === 'ar' 
              ? (this.data.employee ? 'تم تحديث بيانات الموظف بنجاح' : 'تم إضافة الموظف بنجاح')
              : (this.data.employee ? 'Employee updated successfully' : 'Employee added successfully')
          );
          this.dialogRef.close(true);
        },
        error: (err) => {
          console.error('API Error:', err);
          this.toastr.error(
            this.currentLang === 'ar' ? 'حدث خطأ أثناء العملية' : 'Error during operation'
          );
        }
      });
    } else {
      this.employeeForm.markAllAsTouched();
    }
  }

  private findInvalidControls() {
    const invalid = [];
    const controls = this.employeeForm.controls;
    for (const name in controls) {
      if (controls[name].invalid) {
        invalid.push(name);
      }
    }
    return invalid;
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }
}
