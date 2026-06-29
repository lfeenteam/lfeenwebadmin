import { Component, HostListener, ElementRef, Output, EventEmitter } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { CoreService } from 'src/app/services/core.service';
import { LoginService } from 'src/app/pages/dashboards/dashboard3/services/login/login.service';

interface AppLanguage {
  language: string;
  code: string;
  icon: string;
}

@Component({
  selector: 'app-dashboard3-header',
  standalone: true,
  imports: [MaterialModule, TablerIconsModule, CommonModule, TranslateModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  menuOpen = false;
  fullName = '';
  userRole = '';

  @Output() sidebarToggle = new EventEmitter<void>();

  public selectedLanguage: AppLanguage;
  public languages: AppLanguage[] = [
    {
      language: 'العربية',
      code: 'ar',
      icon: '/assets/images/flag/icon-flag-es.svg',
    },
    {
      language: 'English',
      code: 'en',
      icon: '/assets/images/flag/icon-flag-en.svg',
    },
  ];

  constructor(
    private eRef: ElementRef,
    private translate: TranslateService,
    private router: Router,
    private settings: CoreService,
    public loginService: LoginService
  ) {
    const user = this.loginService.getUser();
    this.fullName = user?.fullName || '';
    this.userRole = Array.isArray(user?.roles) ? user.roles.join(', ') : user?.roles || '';
    const urlSegments = this.router.url.split('/').filter(Boolean);
    const langCode = urlSegments.length > 0 && this.languages.some(l => l.code === urlSegments[0])
      ? urlSegments[0]
      : (this.settings.getOptions().language || 'ar');
    this.selectedLanguage = this.languages.find(l => l.code === langCode) || this.languages[0];
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  onSidebarToggle(event: Event): void {
    event.stopPropagation();
    this.sidebarToggle.emit();
  }

  changeLanguage(lang: AppLanguage): void {
    this.selectedLanguage = lang;

    const dir = lang.code === 'ar' ? 'rtl' : 'ltr';
    this.settings.setOptions({ language: lang.code, dir }, true);
    this.translate.use(lang.code);

    const urlSegments = this.router.url.split('/').filter(Boolean);
    if (urlSegments.length > 0 && this.languages.some(l => l.code === urlSegments[0])) {
      urlSegments[0] = lang.code;
    } else {
      urlSegments.unshift(lang.code);
    }
    this.router.navigateByUrl('/' + urlSegments.join('/'));
  }

  navigateToProfile(): void {
    const urlSegments = this.router.url.split('/').filter(Boolean);
    const lang = urlSegments.length > 0 && this.languages.some(l => l.code === urlSegments[0])
      ? urlSegments[0]
      : (this.selectedLanguage.code || 'ar');
    this.router.navigateByUrl(`/${lang}/d3/profile`);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.menuOpen && !this.eRef.nativeElement.contains(event.target)) {
      this.menuOpen = false;
    }
  }
}
