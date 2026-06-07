import { Component, computed, EventEmitter, HostBinding, Input, OnInit, Output, signal } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NavItem, SidebarService } from '../../../pages/dashboards/dashboard3/services/sidebar.service';
import { LoginService } from '../../../pages/dashboards/dashboard3/services/login/login.service';
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

  constructor(
    private router: Router,
    private sidebarService: SidebarService,
    private translate: TranslateService,
    private loginService: LoginService
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

  isActive(item: NavItem): boolean {
    if (!item.link) return false;
    const built = this.buildLink(item.link);
    return this.router.url === built || this.router.url.startsWith(built + '/');
  }

  isChildActive(item: NavItem): boolean {
    return !!item.children?.some(child => this.isActive(child));
  }

  toggleSidebar(): void {
    this.collapsed = !this.collapsed;
    this.collapsedChange.emit(this.collapsed);
  }

  logout(): void {
    this.loginService.logout();
    this.router.navigateByUrl(this.getLangPrefix() + '/d3/login');
  }
}
