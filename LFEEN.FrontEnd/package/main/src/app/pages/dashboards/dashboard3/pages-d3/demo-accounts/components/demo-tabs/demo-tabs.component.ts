import { Component, ElementRef, Injector, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// "Demo accounts · Activation requests · Demo links" tabs, shown on top of those screens.
@Component({
  selector: 'app-demo-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TablerIconsModule, TranslateModule],
  template: `
    <nav class="da-root dt" [attr.aria-label]="'d3.demoAccounts.title' | translate">
      <a class="dt__tab" [routerLink]="['/', lang, 'd3', 'demo-accounts']"
         routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">
        <i-tabler name="flask" class="icon-16"></i-tabler>
        {{ 'd3.demoAccounts.tabs.accounts' | translate }}
      </a>
      <a class="dt__tab" [routerLink]="['/', lang, 'd3', 'demo-accounts', 'activation-requests']"
         routerLinkActive="active" ariaCurrentWhenActive="page">
        <i-tabler name="user-star" class="icon-16"></i-tabler>
        {{ 'd3.demoAccounts.tabs.activationRequests' | translate }}
      </a>
      <a class="dt__tab" [routerLink]="['/', lang, 'd3', 'demo-accounts', 'signup-links']"
         routerLinkActive="active" ariaCurrentWhenActive="page">
        <i-tabler name="link" class="icon-16"></i-tabler>
        {{ 'd3.demoAccounts.tabs.signupLinks' | translate }}
      </a>
    </nav>
  `,
  styles: [`
    @use '../../demo-accounts';
    :host { display: block; margin-bottom: 20px; }
    .dt { display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: #F1F5F9; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
    .dt::-webkit-scrollbar { display: none; }
    .dt__tab {
      display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px; border-radius: 9px;
      font-size: 13px; font-weight: 700; color: #6B6B67; text-decoration: none; white-space: nowrap; flex-shrink: 0;
      transition: background 0.2s ease, color 0.2s ease;
      &:hover { color: #111110; }
      &.active { background: #fff; color: #111110; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
    }
    @media (max-width: 576px) { .dt__tab { padding: 0 12px; } }
  `]
})
export class DemoTabsComponent {
  private readonly translate = inject(TranslateService);
  /** Follows the sidebar language switch, so the tab links keep the current /ar or /en prefix. */
  lang = this.translate.currentLang || 'ar';
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed())
      .subscribe(event => { this.lang = event.lang; });

    // On a narrow screen the strip scrolls: bring the open tab into view (it may be off-screen,
    // e.g. the third tab in RTL). Only the strip's own scroll moves — never the page.
    // routerLinkActive may set .active only once the navigation ends, so look again a moment later.
    afterNextRender(() => {
      if (!this.revealActiveTab()) setTimeout(() => this.revealActiveTab(), 60);
    }, { injector: inject(Injector) });
  }

  /** Centres the open tab in the strip. false when it isn't marked active yet. */
  private revealActiveTab(): boolean {
    const nav = this.host.nativeElement.querySelector<HTMLElement>('.dt');
    const active = nav?.querySelector<HTMLElement>('.dt__tab.active');
    if (!nav || !active) return false;
    if (nav.scrollWidth <= nav.clientWidth) return true;
    const navBox = nav.getBoundingClientRect();
    const tabBox = active.getBoundingClientRect();
    // A relative move, so it works the same in RTL and LTR.
    nav.scrollLeft += (tabBox.left + tabBox.width / 2) - (navBox.left + navBox.width / 2);
    return true;
  }
}
