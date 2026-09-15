import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Subscription } from 'rxjs';
import { LoginService } from '../../dashboards/dashboard3/services/login/login.service';

@Component({
  selector: 'app-error',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, TablerIconsModule],
  templateUrl: './error.component.html',
  styleUrl: './error.component.scss',
})
export class AppErrorComponent implements OnInit, OnDestroy {
  private langSub?: Subscription;

  constructor(
    private translate: TranslateService,
    private loginService: LoginService,
    private titleService: Title
  ) {}

  ngOnInit(): void {
    this.updateBrowserTitle();
    this.langSub = this.translate.onLangChange.subscribe(() => this.updateBrowserTitle());
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  private updateBrowserTitle(): void {
    const supervisorTitle = this.translate.instant('d3.header.supervisorTitle');
    const notFoundTitle = this.translate.instant('notFound.title');
    this.titleService.setTitle(`${supervisorTitle} | ${notFoundTitle}`);
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  // Root ('/') always redirects to the login screen regardless of auth state,
  // so send authenticated users straight to the dashboard instead.
  get homeLink(): string {
    const lang = this.translate.currentLang || 'ar';
    const authed = this.loginService.isAuthenticated() || this.loginService.hasValidRefreshToken();
    return authed ? `/${lang}/d3/ceo` : `/${lang}/d3/login`;
  }

  refreshPage(): void {
    window.location.reload();
  }
}
