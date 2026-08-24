import { Component, Inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DepartmentService } from '../../../../services/department.service';
import { Permission, PermissionGroup, PermissionPayload } from '../../../../interfaces/department.model';
import { extractApiErrorMessage } from '../../../../utils/api-error.util';

const SAFE_NAME_EN_PATTERN = /^[a-zA-Z0-9\s._-]+$/;
const ACTION_OPTIONS = ['View', 'Create', 'Update', 'Delete', 'Manage', 'Export', 'Assign'];

@Component({
  selector: 'app-add-permission-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './add-permission-dialog.component.html',
  styleUrl: './add-permission-dialog.component.scss'
})
export class AddPermissionDialogComponent implements OnInit {
  permissionForm: FormGroup;
  isSubmitting = false;
  permissionGroups: PermissionGroup[] = [];
  actionOptions = ACTION_OPTIONS;

  constructor(
    private fb: FormBuilder,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    public dialogRef: MatDialogRef<AddPermissionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { permission?: Permission }
  ) {
    const p = this.data.permission;
    this.permissionForm = this.fb.group({
      code: [p?.code || '', [Validators.required, Validators.pattern(/^[A-Z][a-zA-Z0-9]*\.[A-Z][a-zA-Z0-9]*$/)]],
      nameAr: [p?.nameAr || '', [Validators.required, Validators.minLength(2)]],
      nameEn: [p?.nameEn || '', [Validators.required, Validators.pattern(SAFE_NAME_EN_PATTERN)]],
      descriptionAr: [p?.descriptionAr || ''],
      descriptionEn: [p?.descriptionEn || ''],
      action: [p?.action || '', Validators.required],
      permissionGroupId: [p?.permissionGroupId || '', Validators.required]
    });
  }

  ngOnInit(): void {
    this.departmentService.getAllPermissionGroupsForDropdown().subscribe({
      next: (groups) => {
        this.permissionGroups = groups;
        this.cdr.detectChanges();
      },
      error: () => {}
    });

    if (this.data.permission?.id) {
      this.departmentService.getPermissionById(this.data.permission.id).subscribe({
        next: (permission) => {
          this.permissionForm.patchValue({
            code: permission.code || '',
            nameAr: permission.nameAr || '',
            nameEn: permission.nameEn || '',
            descriptionAr: permission.descriptionAr || '',
            descriptionEn: permission.descriptionEn || '',
            action: permission.action || '',
            permissionGroupId: permission.permissionGroupId || ''
          });
          this.cdr.detectChanges();
        },
        error: () => {}
      });
    }
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  groupDisplayName(group: PermissionGroup): string {
    return (this.currentLang === 'ar' ? group.nameAr : group.nameEn)
      ?? group.name
      ?? group.nameAr
      ?? group.nameEn
      ?? '';
  }

  save(): void {
    if (this.permissionForm.invalid) {
      this.permissionForm.markAllAsTouched();
      this.cdr.detectChanges();
      this.toastr.warning(this.translate.instant('d3.toast.fillRequired'));
      return;
    }

    this.isSubmitting = true;
    const v = this.permissionForm.value;
    const payload: PermissionPayload = {
      permissionGroupId: v.permissionGroupId,
      code: v.code,
      nameAr: v.nameAr,
      nameEn: v.nameEn,
      descriptionAr: v.descriptionAr,
      descriptionEn: v.descriptionEn,
      action: v.action
    };

    const request = this.data.permission
      ? this.departmentService.updatePermission(this.data.permission.id, payload)
      : this.departmentService.createPermission(payload);

    request.subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.toastr.success(
          this.translate.instant(this.data.permission ? 'd3.toast.editPermissionSuccess' : 'd3.toast.addPermissionSuccess')
        );
        this.dialogRef.close({ ...this.data.permission, ...payload, id: this.data.permission?.id || response?.id });
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.errorOp')));
        this.cdr.detectChanges();
      }
    });
  }
}
