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

    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const urlLang = event.urlAfterRedirects.split('/')[1];
        if (['ar', 'en'].includes(urlLang)) {
          this.settings.setOptions({ language: urlLang, dir: urlLang === 'ar' ? 'rtl' : 'ltr' });
        }
      }
    });
  }

  ngOnInit() {
    if (!this.settings.hasPreferredLanguage()) {
      this.settings.updateFromBrowserLanguage();
    }
  }
}
