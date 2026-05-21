import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CoreService } from './services/core.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  title = 'Modernize Angular Admin Tempplate';
  options = this.settings.getOptions();

  constructor(private settings: CoreService, private translate: TranslateService, private router: Router) {
    this.translate.use(this.settings.getOptions().language);

    // مراقبة تغييرات الـ route
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const urlLang = event.urlAfterRedirects.split('/')[1];
        if (['ar', 'en'].includes(urlLang)) {
          // تحديث اللغة والاتجاه
          if (urlLang === 'ar') {
            this.settings.setOptions({ language: urlLang, dir: 'rtl' });
            this.options.dir = 'rtl';
          } else {
            this.settings.setOptions({ language: urlLang, dir: 'ltr' });
            this.options.dir = 'ltr';
          }

          // حفظ اللغة المفضلة إذا كانت من user
          if (this.settings.isLanguageFromUser()) {
            localStorage.setItem('preferred_language', urlLang);
            localStorage.setItem('app_settings', JSON.stringify({ ...this.options, language: urlLang, dir: this.options.dir }));
          }
        }
      }
    });

    // مراقبة تغييرات browser language
    this.settings.watchBrowserLanguageChanges();
    
    // مراقبة تغييرات browser language كل 10 ثوان
    setInterval(() => {
      this.checkBrowserLanguageChanges();
    }, 10000);
  }

  ngOnInit() {
    // تحديث اللغة من browser إذا لم يكن هناك preferred language
    if (!this.settings.hasPreferredLanguage()) {
      this.settings.updateFromBrowserLanguage();
    }

    // مراقبة تغييرات browser language عند تحميل الصفحة
    this.checkBrowserLanguageChanges();

    // مراقبة تغييرات browser language عند تحميل الصفحة
    window.addEventListener('load', () => {
      this.checkBrowserLanguageChanges();
    });
  }

  // دالة جديدة للتحقق من تغييرات browser language
  private checkBrowserLanguageChanges(): void {
    const currentBrowserLang = this.settings.getBrowserLanguage();
    const storedBrowserLang = localStorage.getItem('browser_language');
    
    // إذا تغيرت لغة browser ولم يكن هناك preferred language
    if (storedBrowserLang && storedBrowserLang !== currentBrowserLang && !this.settings.hasPreferredLanguage()) {
      this.settings.updateFromBrowserLanguage();
    }
  }
}
