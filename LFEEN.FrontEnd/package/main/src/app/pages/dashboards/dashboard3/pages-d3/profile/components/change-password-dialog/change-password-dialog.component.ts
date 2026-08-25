import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { LoginService } from '../../../../services/login/login.service';
import { extractApiErrorMessage } from '../../../../utils/api-error.util';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return newPassword && confirmPassword && newPassword !== confirmPassword
    ? { passwordsMismatch: true }
    : null;
}

@Component({
  selector: 'app-change-password-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './change-password-dialog.component.html',
  styleUrl: './change-password-dialog.component.scss'
})
export class ChangePasswordDialogComponent {
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private loginService = inject(LoginService);
  private toastr = inject(ToastrService);
  public dialogRef = inject(MatDialogRef<ChangePasswordDialogComponent>);

  showCurrent = false;
  showNew = false;
  showConfirm = false;
  saving = false;

  form: FormGroup = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    },
    { validators: passwordsMatchValidator }
  );

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.value;
    this.saving = true;

    this.loginService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.saving = false;
        this.toastr.success(this.translate.instant('d3.profile.changePasswordDialog.success'));
        this.dialogRef.close();
      },
      error: (err) => {
        this.saving = false;
        const message = extractApiErrorMessage(
          err,
          this.translate.instant('d3.profile.changePasswordDialog.error')
        );
        this.toastr.error(message);
      }
    });
  }
}
