import { Injectable, signal } from '@angular/core';
import { AppSettings, defaults } from '../config';

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

  getBrowserLanguage(): string {
    return navigator.language?.split('-')[0] || 'en';
  }

  hasPreferredLanguage(): boolean {
    const preferred = localStorage.getItem('preferred_language');
    return preferred !== null && ['ar', 'en'].includes(preferred);
  }

  updateFromBrowserLanguage(): void {
    if (this.hasPreferredLanguage()) return;
    const browserLang = this.getBrowserLanguage();
    const lang = ['ar', 'en'].includes(browserLang) ? browserLang : 'en';
    this.setOptions({ language: lang, dir: lang === 'ar' ? 'rtl' : 'ltr' }, false);
  }

  resetPreferredLanguage(): void {
    localStorage.removeItem('preferred_language');
    localStorage.removeItem('app_settings');
    const browserLang = this.getBrowserLanguage();
    const lang = ['ar', 'en'].includes(browserLang) ? browserLang : 'en';
    this.setOptions({ language: lang, dir: lang === 'ar' ? 'rtl' : 'ltr' }, false);
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

  const browserLang = navigator.language?.split('-')[0] || 'en';
  const lang = ['ar', 'en'].includes(browserLang) ? browserLang : 'en';
  return {
    ...defaults,
    language: lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
  };
}
