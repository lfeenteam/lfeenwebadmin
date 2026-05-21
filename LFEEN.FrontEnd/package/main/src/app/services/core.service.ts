import { Injectable, signal } from '@angular/core';
import { AppSettings, defaults } from '../config';

function getQueryParam(param: string): string | null {
  if (typeof window === 'undefined') return null;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

@Injectable({ providedIn: 'root' })
export class CoreService {
  private optionsSignal = signal<AppSettings>(getInitialSettings());

  getOptions() {
    return this.optionsSignal();
  }

  getOptionsSignal() {
    return this.optionsSignal;
  }

  setOptions(options: Partial<AppSettings>, manual = false) {
    this.optionsSignal.update((current) => {
      const updated = {
        ...current,
        ...options,
        dir: options.dir ?? (options.language === 'ar' ? 'rtl' : 'ltr'),
      };

      if (manual) {
        localStorage.setItem('preferred_language', updated.language);
        localStorage.setItem('app_settings', JSON.stringify(updated));
        localStorage.setItem('browser_language_source', 'user');
      }

      return updated;
    });
  }

  setLanguage(lang: string, manual = false) {
    this.setOptions({ language: lang }, manual);
  }

  getLanguage() {
    return this.getOptions().language;
  }

  // دالة جديدة للحصول على browser language الحالي
  getBrowserLanguage(): string {
    return navigator.language?.split('-')[0] || 'en';
  }

  // دالة جديدة للتحقق من وجود preferred language
  hasPreferredLanguage(): boolean {
    const preferred = localStorage.getItem('preferred_language');
    return preferred !== null && ['ar', 'en'].includes(preferred);
  }

  // دالة جديدة للتحقق من مصدر تغيير اللغة
  isLanguageFromUser(): boolean {
    return localStorage.getItem('browser_language_source') === 'user';
  }

  // دالة جديدة لتحديث اللغة من browser
  updateFromBrowserLanguage(): void {
    const browserLang = this.getBrowserLanguage();
    const lang = ['ar', 'en'].includes(browserLang) ? browserLang : 'en';
    
    // تحديث فقط إذا لم يكن هناك preferred language
    if (!this.hasPreferredLanguage()) {
      this.setOptions({ language: lang, dir: lang === 'ar' ? 'rtl' : 'ltr' }, false);
      localStorage.setItem('browser_language', lang);
      localStorage.setItem('browser_language_source', 'browser');
      
      // تحديث URL إذا كان مختلفاً
      if (typeof window !== 'undefined') {
        const currentUrl = window.location.pathname;
        const urlSegments = currentUrl.split('/').filter(Boolean);
        
        // إذا كان هناك prefix في URL
        if (urlSegments.length > 0 && ['ar', 'en'].includes(urlSegments[0])) {
          if (urlSegments[0] !== lang) {
            urlSegments[0] = lang;
            const newUrl = '/' + urlSegments.join('/');
            window.history.replaceState(null, '', newUrl);
          }
        } else {
          // إذا لم يكن هناك prefix، أضيفه
          const newUrl = '/' + lang + currentUrl;
          window.history.replaceState(null, '', newUrl);
        }
      }
    }
  }

  // دالة جديدة لمراقبة تغييرات browser language
  watchBrowserLanguageChanges(): void {
    // مراقبة تغييرات اللغة في browser
    if (typeof window !== 'undefined' && 'language' in navigator) {
      // مراقبة تغييرات اللغة عند تحميل الصفحة
      window.addEventListener('beforeunload', () => {
        const currentBrowserLang = this.getBrowserLanguage();
        const storedBrowserLang = localStorage.getItem('browser_language');
        
        // إذا تغيرت لغة browser ولم يكن هناك preferred language
        if (storedBrowserLang !== currentBrowserLang && !this.hasPreferredLanguage()) {
          localStorage.setItem('browser_language', currentBrowserLang);
          localStorage.setItem('browser_language_source', 'browser');
        }
      });

      // مراقبة تغييرات اللغة عند العودة للصفحة
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          const currentBrowserLang = this.getBrowserLanguage();
          const storedBrowserLang = localStorage.getItem('browser_language');
          
          // إذا تغيرت لغة browser ولم يكن هناك preferred language
          if (storedBrowserLang && storedBrowserLang !== currentBrowserLang && !this.hasPreferredLanguage()) {
            this.updateFromBrowserLanguage();
          }
        }
      });
    }
  }

  // دالة جديدة لإعادة تعيين preferred language
  resetPreferredLanguage(): void {
    localStorage.removeItem('preferred_language');
    localStorage.setItem('browser_language_source', 'browser');
    
    const browserLang = this.getBrowserLanguage();
    const lang = ['ar', 'en'].includes(browserLang) ? browserLang : 'en';
    
    this.setOptions({ language: lang, dir: lang === 'ar' ? 'rtl' : 'ltr' }, false);
    localStorage.setItem('browser_language', lang);
    
    // تحديث URL
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.pathname;
      const urlSegments = currentUrl.split('/').filter(Boolean);
      
      if (urlSegments.length > 0 && ['ar', 'en'].includes(urlSegments[0])) {
        if (urlSegments[0] !== lang) {
          urlSegments[0] = lang;
          const newUrl = '/' + urlSegments.join('/');
          window.history.replaceState(null, '', newUrl);
        }
      }
    }
  }
}

function getInitialSettings(): AppSettings {
  const preferredLang = localStorage.getItem('preferred_language');
  const appSettings = localStorage.getItem('app_settings');

  if (preferredLang && appSettings) {
    try {
      return { ...defaults, ...JSON.parse(appSettings) };
    } catch {}
  }

  const browserLang = getBrowserLang();
  return {
    ...defaults,
    language: browserLang,
    dir: browserLang === 'ar' ? 'rtl' : 'ltr',
  };
}

function getBrowserLang(): string {
  return navigator.language?.split('-')[0] || 'en';
}
