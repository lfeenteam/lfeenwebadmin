import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class LanguageRedirectGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(): UrlTree {
    // تحقق من وجود preferred language محفوظ
    let preferredLang: string | null = localStorage.getItem('preferred_language');
    
    if (preferredLang && ['ar', 'en'].includes(preferredLang)) {
      // إذا كان هناك preferred language، استخدم prefix
      return this.router.parseUrl('/' + preferredLang);
    } else {
      // إذا لم يكن هناك preferred language، استخدم browser language بدون prefix
      let browserLang = navigator.language?.split('-')[0] || 'en';
      let lang = ['ar', 'en'].includes(browserLang) ? browserLang : 'en';
      
      // حفظ browser language كمرجع
      localStorage.setItem('browser_language', lang);
      localStorage.setItem('browser_language_source', 'browser');
      
      // إعادة توجيه بدون prefix
      return this.router.parseUrl('/' + lang);
    }
  }
} 