import { Component, Inject, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
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
import { Subscription } from 'rxjs';
import { DepartmentService } from '../../../../services/department.service';
import { Department, DepartmentRole, Employee } from '../../../../interfaces/department.model';
import intlTelInput from 'intl-tel-input';
import type { Iti, SomeOptions, UiTranslations } from 'intl-tel-input';

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
export class AddEmployeeDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  employeeForm: FormGroup;
  roles: DepartmentRole[] = [];
  isDropdownOpen = false;
  isSubmitting = false;
  selectedRole: { name?: string; nameAr?: string; nameEn?: string } | null = null;
  serverErrors: Record<string, string> = {};

  // Department dropdown (used when fromAllEmployees = true)
  departments: Department[] = [];
  selectedDept: Department | null = null;
  isDeptDropdownOpen = false;

  @ViewChild('phoneInputRef') private phoneInputRef!: ElementRef<HTMLInputElement>;
  private iti: Iti | null = null;
  private langSub: Subscription | null = null;

  private readonly arUiTranslations: UiTranslations = {
    searchPlaceholder: 'بحث',
    noCountrySelected: 'اختر دولة',
    countryListAriaLabel: 'قائمة الدول',
    clearSearchAriaLabel: 'مسح البحث',
    searchEmptyState: 'لا توجد نتائج',
  };

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
    @Inject(MAT_DIALOG_DATA) public data: { departmentId: string; employee?: Partial<Employee>; fromAllEmployees?: boolean }
  ) {
    this.employeeForm = this.fb.group({
      fullName: [this.data.employee?.fullName || '', [Validators.required, Validators.minLength(2)]],
      email: [this.data.employee?.email || '', [Validators.required, Validators.email]],
      phoneNumber: [this.data.employee?.phoneNumber || '', [Validators.required, Validators.pattern(/^[\d\s+\-().]+$/)]],
      roleId: [this.data.employee?.roles?.[0]?.roleId || '', Validators.required],
    });

    if (this.data.employee) {
      this.selectedRole = this.data.employee.roles?.[0] ?? null;
    }
  }

  ngOnInit(): void {
    if (this.data.fromAllEmployees) {
      this.loadDepartments();
    } else {
      this.loadRoles();
    }
  }

  ngAfterViewInit(): void {
    this.initPhoneInput();
    this.langSub = this.translate.onLangChange.subscribe(() => {
      this.reinitPhoneInput();
    });
  }

  ngOnDestroy(): void {
    this.iti?.destroy();
    this.langSub?.unsubscribe();
  }

  private initPhoneInput(restoreNumber?: string): void {
    const input = this.phoneInputRef.nativeElement;
    // Phone numbers are always read LTR regardless of the app language
    input.setAttribute('dir', 'ltr');

    const isArabic = this.currentLang === 'ar';

    const options: SomeOptions = {
      initialCountry: 'sa',
      separateDialCode: true,
      showFlags: true,
      countrySearch: true,
      countryNameLocale: isArabic ? 'ar' : 'en',
      uiTranslations: isArabic ? this.arUiTranslations : undefined,
      dropdownParent: document.body,
      // @ts-ignore — 'intl-tel-input/utils' subpath is not in typesVersions for moduleResolution:node; resolved by esbuild at build time
      loadUtils: () => import('intl-tel-input/utils'),
    };

    this.iti = intlTelInput(input, options);

    const number = restoreNumber ?? this.data.employee?.phoneNumber;
    if (number) {
      this.iti.setNumber(number);
      const national = input.value;
      this.employeeForm.get('phoneNumber')?.setValue(national, { emitEvent: false });
    }
  }

  private reinitPhoneInput(): void {
    const currentValue = this.employeeForm.get('phoneNumber')?.value as string ?? '';
    this.iti?.destroy();
    this.iti = null;
    this.initPhoneInput(currentValue || undefined);
  }

  get selectedDialCode(): string {
    const country = this.iti?.getSelectedCountry();
    return country ? `+${country.dialCode}` : '';
  }

  getFullPhoneNumber(): string {
    return this.iti?.getNumber() ?? this.employeeForm.get('phoneNumber')?.value ?? '';
  }

  loadDepartments(): void {
    this.departmentService.getAllDepartmentsForDropdown().subscribe({
      next: (depts) => {
        this.departments = depts;
        this.cdr.detectChanges();
      },
      error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp'))
    });
  }

  selectDepartment(dept: Department): void {
    this.selectedDept = dept;
    this.isDeptDropdownOpen = false;
    this.roles = [];
    this.selectedRole = null;
    this.employeeForm.get('roleId')?.setValue('');
    this.loadRoles();
    this.cdr.detectChanges();
  }

  getSelectedDeptName(): string {
    if (!this.selectedDept) return '';
    return (this.currentLang === 'ar' ? this.selectedDept.nameAr : this.selectedDept.nameEn)
      || this.selectedDept.name
      || '';
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
    const deptId = this.data.fromAllEmployees ? this.selectedDept?.id : this.data.departmentId;
    if (!deptId) return;
    this.departmentService.getDepartmentRoles(deptId).subscribe({
      next: (roles) => {
        this.roles = roles;
        this.cdr.detectChanges();
      },
      error: () => this.toastr.error(this.translate.instant('d3.toast.errorOp'))
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
    if (this.data.fromAllEmployees && !this.selectedDept) {
      this.toastr.warning(
        this.translate.instant('d3.toast.selectDeptFirst')
      );
      return;
    }

    if (this.employeeForm.valid) {
      const formData = this.employeeForm.value;
      const submissionData = {
        fullName: formData.fullName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        roleIds: [formData.roleId]
      };

      const deptId = this.data.fromAllEmployees ? this.selectedDept!.id : this.data.departmentId;

      const request = this.data.employee
        ? this.departmentService.updateEmployee(deptId, this.data.employee.userId!, submissionData)
        : this.departmentService.addEmployee(deptId, submissionData);

      this.serverErrors = {};
      this.isSubmitting = true;

      request.subscribe({
        next: () => {
          this.isSubmitting = false;
          this.toastr.success(
            this.translate.instant(this.data.employee ? 'd3.toast.updateEmployeeSuccess' : 'd3.toast.addEmployeeSuccess')
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
              this.translate.instant('d3.toast.errorOp')
            );
          }
        }
      });
    } else {
      this.employeeForm.markAllAsTouched();
      this.cdr.detectChanges();
      this.toastr.warning(
        this.translate.instant('d3.toast.fillAllRequired')
      );
    }
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }
}
