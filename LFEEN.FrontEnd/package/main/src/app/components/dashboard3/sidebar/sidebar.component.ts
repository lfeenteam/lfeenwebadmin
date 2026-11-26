import { Component, computed, effect, ElementRef, EventEmitter, HostBinding, Input, Output, signal } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavItem, SidebarService } from '../../../pages/dashboards/dashboard3/services/sidebar.service';
import { LoginService } from '../../../pages/dashboards/dashboard3/services/login/login.service';
import { CoreService } from 'src/app/services/core.service';
import { filter } from 'rxjs/operators';
import { PAGE_FLAGS } from 'src/app/config/page-flags';
import {
  SETTINGS_PERMISSIONS, hasSettingsPermission,
} from '../../../pages/dashboards/dashboard3/interfaces/platform-settings.model';

@Component({
  selector: 'app-dashboard3-sidebar',
  standalone: true,
  imports: [MaterialModule, RouterModule, TablerIconsModule, CommonModule, TranslateModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
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
  /** Tracks router.url so the active-link lookup is computed once per navigation. */
  private currentUrl = signal(this.router.url);
  /** Settings link: same rule as its route guard, so it is never a dead link (BUG-2496). */
  private canViewSettings = computed(() =>
    !!PAGE_FLAGS['settings'] && hasSettingsPermission(this.loginService, SETTINGS_PERMISSIONS.view)
  );

  // Settings stays in the list on every page (the sidebar footer that duplicated it is gone);
  // it is only hidden from admins who can't open it.
  filteredNavItems = computed(() => {
    const canSettings = this.canViewSettings();
    const visible = this.sidebarService.sidebarItems().filter(item =>
      canSettings || (item.translationKey !== 'd3.sidebar.settings' && item.key !== 'settings')
    );
    return this.trimDividers(visible);
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
    private el: ElementRef,
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntilDestroyed()
    ).subscribe(() => this.currentUrl.set(this.router.url));

    // Open the group holding the current page (e.g. landing straight on a subscriptions page).
    effect(() => {
      const active = this.bestMatchingLink();
      if (!active) return;
      for (const item of this.filteredNavItems()) {
        if (item.children?.some(child => child.link === active)) {
          this.expandedItems[this.itemKey(item)] = true;
        }
      }
    });
  }

  /** Hiding items can leave a divider first, last, or next to another one — drop those. */
  private trimDividers(items: NavItem[]): NavItem[] {
    const result: NavItem[] = [];
    for (const item of items) {
      if (item.divider && (!result.length || result[result.length - 1].divider)) continue;
      result.push(item);
    }
    if (result[result.length - 1]?.divider) result.pop();
    return result;
  }

  private itemKey(item: NavItem): string {
    return item.id || item.translationKey || '';
  }

  /** Unique @for track key — static entries have no id/key, and dividers have nothing at all. */
  trackKey(item: NavItem, index: number): string {
    return item.divider ? `divider-${index}` : (item.id || item.link || item.translationKey || `item-${index}`);
  }

  getItemTitle(item: NavItem): string {
    return item.title || (item.translationKey ? this.translate.instant(item.translationKey) : '');
  }

  toggleSubmenu(item: NavItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const key = this.itemKey(item);

    // A collapsed sidebar has no room for the submenu — expand it first and open the group.
    if (this.collapsed && !this.mobileMode) {
      this.collapsed = false;
      this.collapsedChange.emit(false);
      this.expandedItems[key] = true;
    } else {
      this.expandedItems[key] = !this.expandedItems[key];
    }

    if (this.expandedItems[key]) {
      setTimeout(() => {
        const expanded = this.el.nativeElement.querySelector('.d3-submenu-container.is-expanded');
        expanded?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }

  isExpanded(item: NavItem): boolean {
    return !!this.expandedItems[this.itemKey(item)];
  }

  getLangPrefix(): string {
    const lang = this.router.url.split('/')[1];
    return ['ar', 'en'].includes(lang) ? '/' + lang : '/' + this.currentLang;
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
    if (this.mobileMode) this.mobileClose.emit();
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
  // Only the most specific matching link wins. Paths and query params are
  // compared separately, so '/d3/team-management?tab=logs' wins over
  // '/d3/team-management' only while that tab is the one open.
  private bestMatchingLink = computed<string | null>(() => {
    const [urlPath, urlQuery = ''] = this.currentUrl().split('?');
    const urlParams = new URLSearchParams(urlQuery);
    let best: string | null = null;
    let bestScore = -1;

    const consider = (itemLink: string, linkToMatch: string) => {
      const [linkPath, linkQuery = ''] = this.buildLink(linkToMatch).split('?');
      if (urlPath !== linkPath && !urlPath.startsWith(linkPath + '/')) return;
      const linkParams = [...new URLSearchParams(linkQuery)];
      if (!linkParams.every(([k, v]) => urlParams.get(k) === v)) return;
      const score = linkPath.length * 10 + linkParams.length;
      if (score > bestScore) {
        bestScore = score;
        best = itemLink;
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
  });

  isActive(item: NavItem): boolean {
    if (!item.link) return false;
    return item.link === this.bestMatchingLink();
  }




  isChildActive(item: NavItem): boolean {
    return !!item.children?.some(child => this.isActive(child));
  }

  /** Icon-only rail (collapsed on desktop; the mobile drawer is always full). */
  get isIconOnly(): boolean {
    return this.collapsed && !this.mobileMode;
  }

  /** The sidebar sits on the inline-start side, so its collapse glyph follows the language. */
  get collapseIcon(): string {
    const side = this.settings.getOptionsSignal()().dir === 'rtl' ? 'right' : 'left';
    return `layout-sidebar-${side}-${this.collapsed ? 'expand' : 'collapse'}`;
  }

  /** Label for the icon-only (collapsed) sidebar; empty disables the tooltip otherwise. */
  tooltipFor(label: string): string {
    return this.collapsed && !this.mobileMode ? label : '';
  }

  toggleSidebar(): void {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
  }


}
