import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { finalize } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { CoreService } from 'src/app/services/core.service';
import { LoginService } from '../../services/login/login.service';
import { extractApiErrorMessage } from '../../utils/api-error.util';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['../login/login.component.scss', '../login/auth-pages.scss']
})
export class ForgotPasswordComponent {
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

  // Prefilled when coming back from an expired reset link.
  readonly form = this.fb.nonNullable.group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email, Validators.maxLength(256)]]
  });

  readonly loading = signal(false);
  readonly sent = signal(false);
  // The API's own localized message — shown as-is, identical for known and unknown emails.
  readonly sentMessage = signal('');
  readonly emailError = signal<string | null>(null);

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
    this.router.navigate(['/', language, 'd3', 'forgot-password'], { queryParamsHandling: 'preserve', replaceUrl: true });
  }

  submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.emailError.set(null);
    this.loading.set(true);

    this.loginService
      .forgotPassword(this.form.getRawValue().email.trim())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        // Same confirmation whether or not the account exists — never reveal which.
        next: (res: { message?: string }) => {
          this.sentMessage.set(res?.message || this.translate.instant('d3.forgotPasswordPage.sentBody'));
          this.sent.set(true);
        },
        error: (err: HttpErrorResponse) => {
          const emailMsg = (err.error?.errors as { field?: string; message?: string }[] | undefined)
            ?.find(e => e.field === 'Request.Email')?.message;
          if (err.status === 400 && emailMsg) {
            this.emailError.set(emailMsg);
            return;
          }
          this.toastr.error(extractApiErrorMessage(err, this.translate.instant('d3.forgotPasswordPage.error')));
        }
      });
  }

  editEmail(): void {
    this.sent.set(false);
  }
}
