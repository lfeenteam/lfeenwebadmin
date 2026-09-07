import { Component, OnInit, computed } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BidiModule } from '@angular/cdk/bidi';
import { CoreService } from './services/core.service';
import { TranslateService } from '@ngx-translate/core';

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
    // Bootstrap default; the ':lang' route's languageSyncGuard keeps CoreService
    // and ngx-translate in sync with the URL from then on (early enough that the
    // AuthInterceptor's Accept-Language header is correct on the first request).
    this.translate.use(this.settings.getOptions().language);
  }

  ngOnInit() {
    if (!this.settings.hasPreferredLanguage()) {
      this.settings.updateFromBrowserLanguage();
    }

    // App bootstrapped successfully, so a future chunk-load error is a
    // fresh occurrence and should be allowed to trigger another reload.
    sessionStorage.removeItem('chunk-load-error-reloaded');
  }
}
