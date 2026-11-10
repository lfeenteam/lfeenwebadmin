import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { finalize } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { CoreService } from 'src/app/services/core.service';
import { LoginService } from '../../services/login/login.service';
import { extractApiErrorMessage } from '../../utils/api-error.util';

interface ApiFieldError {
  field?: string;
  message?: string;
}

// Mirrors the backend rule set for new passwords (8–200 chars + four character classes).
const PASSWORD_RULES = [
  { key: 'length', test: (v: string) => v.length >= 8 && v.length <= 200 },
  { key: 'upper', test: (v: string) => /[A-Z]/.test(v) },
  { key: 'lower', test: (v: string) => /[a-z]/.test(v) },
  { key: 'number', test: (v: string) => /\d/.test(v) },
  { key: 'special', test: (v: string) => /[^A-Za-z0-9\s]/.test(v) },
] as const;

function strongPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value ?? '';
  return !value || PASSWORD_RULES.every(r => r.test(value)) ? null : { weakPassword: true };
}

function passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return newPassword && confirmPassword && newPassword !== confirmPassword ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['../login/login.component.scss', '../login/auth-pages.scss']
})
export class ResetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly loginService = inject(LoginService);
  private readonly toastr = inject(ToastrService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly settings = inject(CoreService);

  readonly languages = [
    { code: 'ar', label: 'العربية', icon: '/assets/images/flag/icon-flag-es.svg' },
    { code: 'en', label: 'English', icon: '/assets/images/flag/icon-flag-en.svg' },
  ];

  // Query params arrive already URL-decoded; they go to the API as-is.
  readonly email = this.route.snapshot.queryParamMap.get('email')?.trim() ?? '';
  private readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';

  // A link missing either part is unusable — no need to ask the API.
  readonly linkInvalid = signal(!this.email || !this.token);
  readonly loading = signal(false);
  readonly passwordErrors = signal<string[]>([]);

  showNew = false;
  showConfirm = false;

  readonly form = this.fb.nonNullable.group(
    {
      newPassword: ['', [Validators.required, strongPasswordValidator]],
      confirmPassword: ['', Validators.required]
    },
    { validators: passwordsMatchValidator }
  );

  private readonly newPasswordValue = toSignal(this.form.controls.newPassword.valueChanges, { initialValue: '' });

  readonly rules = computed(() => {
    const value = this.newPasswordValue();
    return PASSWORD_RULES.map(r => ({ key: r.key, met: r.test(value) }));
  });

  get currentDir(): 'ltr' | 'rtl' {
    return this.translate.currentLang === 'ar' ? 'rtl' : 'ltr';
  }

  get targetLanguage() {
    const targetCode = this.translate.currentLang === 'ar' ? 'en' : 'ar';
    return this.languages.find(l => l.code === targetCode)!;
  }

  toggleLanguage(): void {
    const language = this.targetLanguage.code;
    this.settings.setOptions({ language, dir: language === 'ar' ? 'rtl' : 'ltr' }, true);
    this.translate.use(language);
    // Keep email/token in the URL so the link still works after switching language.
    this.router.navigate(['/', language, 'd3', 'reset-password'], { queryParamsHandling: 'preserve', replaceUrl: true });
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.passwordErrors.set([]);
    this.loading.set(true);

    this.loginService
      .resetPassword(this.email, this.token, this.form.getRawValue().newPassword)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res: { message?: string }) => {
          this.toastr.success(res?.message || this.translate.instant('d3.resetPasswordPage.success'));
          this.router.navigate(['/', this.translate.currentLang || 'ar', 'd3', 'login'], { replaceUrl: true });
        },
        error: (err: HttpErrorResponse) => this.handleError(err)
      });
  }

  private handleError(err: HttpErrorResponse): void {
    const errors: ApiFieldError[] = Array.isArray(err.error?.errors) ? err.error.errors : [];

    if (err.status === 400) {
      // Invalid / used / expired token, or a tampered email — all mean "this link is dead".
      if (errors.some(e => e.field === 'Token' || e.field === 'Request.Email')) {
        this.linkInvalid.set(true);
        return;
      }

      const passwordMessages = errors
        .filter(e => e.field === 'Request.NewPassword' && e.message)
        .map(e => e.message!);
      if (passwordMessages.length) {
        this.passwordErrors.set(passwordMessages);
        return;
      }
    }

    this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.resetPasswordPage.error')));
  }
}
