import { Component, Inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DepartmentService } from '../../../../services/department.service';
import { PermissionGroup, PermissionGroupPayload } from '../../../../interfaces/department.model';
import { extractApiErrorMessage } from '../../../../utils/api-error.util';

const SAFE_NAME_EN_PATTERN = /^[a-zA-Z0-9\s._-]+$/;

@Component({
  selector: 'app-add-permission-group-dialog',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './add-permission-group-dialog.component.html',
  styleUrl: './add-permission-group-dialog.component.scss'
})
export class AddPermissionGroupDialogComponent {
  groupForm: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private departmentService: DepartmentService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    public dialogRef: MatDialogRef<AddPermissionGroupDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { group?: PermissionGroup }
  ) {
    const g = this.data.group;
    this.groupForm = this.fb.group({
      nameAr: [g?.nameAr || '', [Validators.required, Validators.minLength(2)]],
      nameEn: [g?.nameEn || '', [Validators.required, Validators.pattern(SAFE_NAME_EN_PATTERN)]],
      descriptionAr: [g?.descriptionAr || ''],
      descriptionEn: [g?.descriptionEn || '']
    });
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  save(): void {
    if (this.groupForm.invalid) {
      this.groupForm.markAllAsTouched();
      this.cdr.detectChanges();
      this.toastr.warning(this.translate.instant('d3.toast.fillRequired'));
      return;
    }

    this.isSubmitting = true;
    const payload: PermissionGroupPayload = this.groupForm.value;

    const request = this.data.group
      ? this.departmentService.updatePermissionGroup(this.data.group.id, payload)
      : this.departmentService.createPermissionGroup(payload);

    request.subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.toastr.success(
          this.translate.instant(this.data.group ? 'd3.toast.editPermissionGroupSuccess' : 'd3.toast.addPermissionGroupSuccess')
        );
        this.dialogRef.close({ ...this.data.group, ...payload, id: this.data.group?.id || response?.id });
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.toast.errorOp')));
        this.cdr.detectChanges();
      }
    });
  }
}
