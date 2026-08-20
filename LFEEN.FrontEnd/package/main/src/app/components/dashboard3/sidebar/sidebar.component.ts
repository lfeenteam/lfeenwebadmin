import { Component, computed, ElementRef, EventEmitter, HostBinding, Input, OnInit, Output, signal } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavItem, SidebarService } from '../../../pages/dashboards/dashboard3/services/sidebar.service';
import { LoginService } from '../../../pages/dashboards/dashboard3/services/login/login.service';
import { CoreService } from 'src/app/services/core.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard3-sidebar',
  standalone: true,
  imports: [MaterialModule, RouterModule, TablerIconsModule, CommonModule, TranslateModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {
  @Input() collapsed = false;
  @Output() collapsedChange = new EventEmitter<boolean>();
  @Input() mobileMode = false;
  @Output() mobileClose = new EventEmitter<void>();

  @HostBinding('class.collapsed') get isCollapsed() {
    return this.collapsed && !this.mobileMode;
  }

  @HostBinding('class.mobile-mode') get isMobileMode() {
    return this.mobileMode;
  }

  closeMobile(): void {
    this.mobileClose.emit();
  }

  expandedItems: { [key: string]: boolean } = {};
  isCeoPage = signal<boolean>(false);
  user = this.loginService.currentUser;

  // computed: يتحدث تلقائيًا لما sidebarItems أو isCeoPage يتغيروا
  filteredNavItems = computed(() => {
    const items = this.sidebarService.sidebarItems();
    if (this.isCeoPage()) return items;
    return items.filter(item =>
      item.translationKey !== 'd3.sidebar.settings' &&
      item.key !== 'settings'
    );
  });

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  constructor(
    private router: Router,
    private sidebarService: SidebarService,
    private translate: TranslateService,
    private loginService: LoginService,
    private settings: CoreService,
    private el: ElementRef
  ) {
    this.checkIfCeoPage();
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => this.checkIfCeoPage());
  }

  ngOnInit(): void {}

  private checkIfCeoPage(): void {
    this.isCeoPage.set(this.router.url.includes('/ceo'));
  }

  getItemTitle(item: NavItem): string {
    return item.title || (item.translationKey ? this.translate.instant(item.translationKey) : '');
  }

  toggleSubmenu(item: NavItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const key = item.id || item.translationKey || '';
    this.expandedItems[key] = !this.expandedItems[key];

    if (this.expandedItems[key]) {
      setTimeout(() => {
        const expanded = this.el.nativeElement.querySelector('.d3-submenu-container.is-expanded');
        expanded?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }

  isExpanded(item: NavItem): boolean {
    const key = item.id || item.translationKey || '';
    return !!this.expandedItems[key];
  }

  getLangPrefix(): string {
    const lang = this.router.url.split('/')[1];
    return ['ar', 'en'].includes(lang) ? '/' + lang : '/en';
  }

  buildLink(link?: string): string {
    if (!link) return '';
    const normalized = link.startsWith('/') ? link : '/' + link;
    return this.getLangPrefix() + normalized;
  }

  navigateTo(item: NavItem, event: Event): void {
    event.preventDefault();
    if (!item.link) return;
    this.router.navigateByUrl(this.buildLink(item.link));
  }

  // Some review flows live at a sibling path instead of nested under their list
  // page (e.g. unit-review/:buildingId/:unitId is not under /units/...), so the
  // link's own prefix can't detect them. Map those review paths to the list-page
  // link they conceptually belong to, so the sidebar still highlights correctly.
  private readonly activeUrlAliases: Record<string, string[]> = {
    '/d3/units':     ['/d3/unit-review'],
    '/d3/buildings': ['/d3/build-review'],
  };

  // When two sidebar items' links share a prefix (e.g. '/d3/roles' and
  // '/d3/roles/add'), naive prefix matching would mark both active at once.
  // Only the longest (most specific) matching link should win.
  private getBestMatchingLink(): string | null {
    let best: string | null = null;
    let bestLen = -1;

    const consider = (itemLink: string, urlToMatch: string) => {
      const built = this.buildLink(urlToMatch);
      if (this.router.url === built || this.router.url.startsWith(built + '/')) {
        if (built.length > bestLen) {
          bestLen = built.length;
          best = itemLink;
        }
      }
    };

    const walk = (items: NavItem[]) => {
      for (const item of items) {
        if (item.link) {
          consider(item.link, item.link);
          const aliases = this.activeUrlAliases[item.link] ?? [];
          aliases.forEach(alias => consider(item.link!, alias));
        }
        if (item.children?.length) walk(item.children);
      }
    };

    walk(this.filteredNavItems());
    return best;
  }

  isActive(item: NavItem): boolean {
    if (!item.link) return false;
    return item.link === this.getBestMatchingLink();
  }

  get isOnSettingsPage(): boolean {
    return this.router.url.includes('/d3/settings');
  }

  get isOnNotificationsPage(): boolean {
    return this.router.url.includes('/d3/notifications');
  }

  isChildActive(item: NavItem): boolean {
    return !!item.children?.some(child => this.isActive(child));
  }

  toggleSidebar(): void {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
  }

  toggleLanguage(): void {
    const newLang = this.currentLang === 'ar' ? 'en' : 'ar';
    const dir = newLang === 'ar' ? 'rtl' : 'ltr';
    this.settings.setOptions({ language: newLang, dir }, true);
    this.translate.use(newLang);

    const urlSegments = this.router.url.split('/').filter(Boolean);
    if (urlSegments.length > 0 && ['ar', 'en'].includes(urlSegments[0])) {
      urlSegments[0] = newLang;
    } else {
      urlSegments.unshift(newLang);
    }
    this.router.navigateByUrl('/' + urlSegments.join('/'));
  }

  logout(): void {
    this.loginService.logout();
    this.router.navigateByUrl(this.getLangPrefix() + '/d3/login');
  }
}
