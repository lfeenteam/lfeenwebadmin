import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { LoginService } from '../../services/login/login.service';
import { SidebarService } from '../../services/sidebar.service';

/**
 * Shown when an admin opens a page they have no permission for (BUG-2496), and as the
 * landing page of an admin with no admin-panel permission at all. Inside the dashboard
 * layout, so the menu, notifications and log-out stay at hand.
 */
@Component({
  selector: 'app-no-access',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule],
  templateUrl: './no-access.component.html',
  styleUrl: './no-access.component.scss',
})
export class NoAccessComponent {
  private router = inject(Router);
  private translate = inject(TranslateService);
  private loginService = inject(LoginService);
  private sidebarService = inject(SidebarService);

  private lang(): string {
    return this.translate.currentLang === 'en' ? 'en' : 'ar';
  }

  /** The admin's own landing page — none when they may open nothing at all. */
  readonly homeUrl = computed(() => {
    this.loginService.sidebar();
    this.loginService.permissions();
    const url = this.sidebarService.landingUrl(this.lang());
    return url.endsWith('/d3/no-access') ? null : url;
  });

  goHome(): void {
    const url = this.homeUrl();
    if (url) this.router.navigateByUrl(url);
  }

  logout(): void {
    const lang = this.lang();
    this.loginService.logout();
    this.router.navigateByUrl(`/${lang}/d3/login`);
  }
}
