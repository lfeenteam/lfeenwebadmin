import { Component, HostListener, ElementRef, Output, EventEmitter } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { CoreService } from 'src/app/services/core.service';

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
    private settings: CoreService
  ) {
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
    this.translate.use(lang.code);
    this.selectedLanguage = lang;

    const dir = lang.code === 'ar' ? 'rtl' : 'ltr';
    this.settings.setOptions({ language: lang.code, dir }, true);
    localStorage.setItem('preferred_language', lang.code);

    const urlSegments = this.router.url.split('/').filter(Boolean);
    if (urlSegments.length > 0 && this.languages.some(l => l.code === urlSegments[0])) {
      urlSegments[0] = lang.code;
    } else {
      urlSegments.unshift(lang.code);
    }
    this.router.navigateByUrl('/' + urlSegments.join('/'));
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.menuOpen && !this.eRef.nativeElement.contains(event.target)) {
      this.menuOpen = false;
    }
  }
}
