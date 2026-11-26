import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { LoginService } from '../../../../services/login/login.service';
import { extractApiErrorMessage, extractApiFieldErrors } from '../../../../utils/api-error.util';
import { PASSWORD_RULES, PasswordRuleKey, passwordComplexityValidator } from '../../../../utils/password-rules.util';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return newPassword && confirmPassword && newPassword !== confirmPassword
    ? { passwordsMismatch: true }
    : null;
}

function notSameAsCurrentValidator(control: AbstractControl): ValidationErrors | null {
  const currentPassword = control.get('currentPassword')?.value;
  const newPassword = control.get('newPassword')?.value;
  return currentPassword && newPassword && currentPassword === newPassword
    ? { sameAsCurrent: true }
    : null;
}

/** API field names (lower-cased, see normalizeApiField) shown under their own input. */
const FIELD_CONTROLS: Record<string, 'currentPassword' | 'newPassword' | 'confirmPassword'> = {
  currentpassword: 'currentPassword',
  newpassword: 'newPassword',
  confirmpassword: 'confirmPassword',
};

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

  readonly passwordRules = PASSWORD_RULES;

  showCurrent = false;
  showNew = false;
  showConfirm = false;
  saving = false;

  form: FormGroup = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, passwordComplexityValidator]],
      confirmPassword: ['', Validators.required]
    },
    { validators: [passwordsMatchValidator, notSameAsCurrentValidator] }
  );

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  /** Show validation feedback for a control once the user has typed in it or left it. */
  showErrors(name: string): boolean {
    const control = this.form.get(name);
    return !!control && (control.dirty || control.touched);
  }

  isRuleMet(key: PasswordRuleKey): boolean {
    const value: string = this.form.get('newPassword')?.value ?? '';
    return PASSWORD_RULES.find((rule) => rule.key === key)!.test(value);
  }

  serverErrors(name: string): string[] {
    return this.form.get(name)?.errors?.['server'] ?? [];
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
        if (this.showFieldErrors(err)) return;
        const message = extractApiErrorMessage(
          err,
          this.translate.instant('d3.profile.changePasswordDialog.error')
        );
        this.toastr.error(message);
      }
    });
  }

  /**
   * Puts the server's field errors under their inputs (cleared as soon as the user edits
   * the field, since Angular re-runs the validators). Returns false when none matched a field.
   */
  private showFieldErrors(err: any): boolean {
    const messages = new Map<string, string[]>();
    for (const { field, message } of extractApiFieldErrors(err)) {
      const controlName = FIELD_CONTROLS[field];
      if (!controlName || !message) continue;
      messages.set(controlName, [...(messages.get(controlName) ?? []), message]);
    }
    messages.forEach((list, controlName) => {
      const control = this.form.get(controlName)!;
      control.setErrors({ ...(control.errors ?? {}), server: list });
      control.markAsTouched();
    });
    return messages.size > 0;
  }
}
