import { Component, OnInit, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BidiModule } from '@angular/cdk/bidi';
import { CoreService } from './services/core.service';
import { TranslateService } from '@ngx-translate/core';

function langFromUrl(): 'ar' | 'en' | undefined {
  return /^#\/(ar|en)(\/|\?|$)/.exec(window.location.hash)?.[1] as 'ar' | 'en' | undefined;
}

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, BidiModule],
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  title = 'Modernize Angular Admin Tempplate';
  options = this.settings.getOptions();

  // Bound to a [dir] host so Angular CDK's Directionality service (used by
  // mat-menu/select/tooltip overlays) reacts live to language switches —
  // its root singleton otherwise only reads dir once at bootstrap.
  dir = computed(() => this.settings.getOptionsSignal()().dir);

  constructor(private settings: CoreService, private translate: TranslateService) {
    // Bootstrap with the URL's language when it has one (#/ar/... or #/en/...), so
    // translate.use() runs once with the same language languageSyncGuard will apply.
    // ngx-translate v14 lets whichever file loads LAST win, so starting with the saved
    // preference and then switching to the URL language could end up on the wrong one.
    const urlLang = langFromUrl();
    if (urlLang && urlLang !== this.settings.getLanguage()) {
      this.settings.setOptions({ language: urlLang, dir: urlLang === 'ar' ? 'rtl' : 'ltr' });
    }
    this.translate.use(this.settings.getOptions().language);
  }

  ngOnInit() {
    // The browser language is only a fallback when the URL doesn't name one.
    if (!this.settings.hasPreferredLanguage() && !langFromUrl()) {
      this.settings.updateFromBrowserLanguage();
    }

    // App bootstrapped successfully, so a future chunk-load error is a
    // fresh occurrence and should be allowed to trigger another reload.
    sessionStorage.removeItem('chunk-load-error-reloaded');
  }
}
