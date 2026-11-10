import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// "Demo accounts · Activation requests" tabs, shown on top of both screens.
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
    </nav>
  `,
  styles: [`
    @use '../../demo-accounts';
    :host { display: block; margin-bottom: 20px; }
    .dt { display: inline-flex; gap: 4px; padding: 4px; border-radius: 12px; background: #F1F5F9; max-width: 100%; overflow-x: auto; }
    .dt__tab {
      display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 16px; border-radius: 9px;
      font-size: 13px; font-weight: 700; color: #6B6B67; text-decoration: none; white-space: nowrap;
      transition: background 0.2s ease, color 0.2s ease;
      &:hover { color: #111110; }
      &.active { background: #fff; color: #111110; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
    }
  `]
})
export class DemoTabsComponent {
  readonly lang = inject(TranslateService).currentLang || 'ar';
}
