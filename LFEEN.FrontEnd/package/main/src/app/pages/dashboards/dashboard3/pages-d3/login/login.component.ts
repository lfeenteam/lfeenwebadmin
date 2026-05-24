import { Component } from '@angular/core';
import { MaterialModule } from '../../../../../material.module';
import { RouterModule } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LoginService } from '../../services/login/login.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

import { TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    MaterialModule,
    RouterModule,
    TablerIconsModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    TranslateModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  loginForm: FormGroup;
  hide = true;
  loading = this.loginService.loading;

  constructor(
    private fb: FormBuilder,
    private loginService: LoginService,
    private toastr: ToastrService,
    private router: Router,
    private translate: TranslateService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      const toastOptions = {
        timeOut: 6000,
        extendedTimeOut: 1500,
      };

      this.loginService.login(this.loginForm.value)
        .pipe(finalize(() => this.loginService.loading.set(false)))
        .subscribe({
          next: (response) => {
            const successMsg = this.translate.instant('d3.loginPage.form.messages.success');
            this.toastr.success(successMsg, undefined, toastOptions);
        
            this.loginService.setToken(response);
          
            const lang = this.translate.currentLang || 'en';
            this.router.navigate([`/${lang}/d3/ceo`]);
          },
          error: (err) => {
            const errorMsg = this.translate.instant('d3.loginPage.form.messages.error');
            this.toastr.error(errorMsg, undefined, toastOptions);
          },
        });
    }
  }
}
