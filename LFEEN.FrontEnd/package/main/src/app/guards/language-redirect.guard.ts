import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class LanguageRedirectGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): UrlTree {
    const preferredLang = localStorage.getItem('preferred_language');
    if (preferredLang && ['ar', 'en'].includes(preferredLang)) {
      return this.router.parseUrl('/' + preferredLang);
    }

    const browserLang = navigator.language?.split('-')[0] || 'en';
    const lang = ['ar', 'en'].includes(browserLang) ? browserLang : 'en';
    return this.router.parseUrl('/' + lang);
  }
}
