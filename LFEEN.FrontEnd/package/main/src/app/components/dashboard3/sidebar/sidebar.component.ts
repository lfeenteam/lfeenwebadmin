import { Component, EventEmitter, HostBinding, Input, OnInit, Output, signal } from '@angular/core';
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

  // فلترة القائمة لاستبعاد الإعدادات إذا لم نكن في صفحة CEO
  filteredNavItems = signal<NavItem[]>([]);

  constructor(
    private router: Router,
    private sidebarService: SidebarService,
    private translate: TranslateService,
    private loginService: LoginService
  ) {
    this.checkIfCeoPage();
    this.updateFilteredItems();
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.checkIfCeoPage();
      this.updateFilteredItems();
    });
  }

  ngOnInit(): void {}

  private updateFilteredItems(): void {
    const items = this.sidebarService.sidebarItems();
    if (!this.isCeoPage()) {
      // استبعاد أي عنصر يخص الإعدادات من القائمة الرئيسية
      this.filteredNavItems.set(items.filter(item => 
        item.titleEn?.toLowerCase() !== 'settings' && 
        item.titleAr !== 'الإعدادات' &&
        item.title !== 'd3.sidebar.settings'
      ));
    } else {
      this.filteredNavItems.set(items);
    }
  }

  private checkIfCeoPage(): void {
    // افترضنا أن صفحة CEO تحتوي على 'ceo' في المسار
    this.isCeoPage.set(this.router.url.includes('/ceo'));
  }

  get currentLang(): string {
    return this.translate.currentLang || 'en';
  }

  getItemTitle(item: NavItem): string {
    if (this.currentLang === 'ar') {
      return item.titleAr || (item.title ? this.translate.instant(item.title) : '');
    }
    return item.titleEn || (item.title ? this.translate.instant(item.title) : '');
  }

  toggleSubmenu(item: NavItem, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const key = item.titleAr || item.title || '';
    this.expandedItems[key] = !this.expandedItems[key];
  }

  isExpanded(item: NavItem): boolean {
    const key = item.titleAr || item.title || '';
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
    return this.router.url.startsWith(this.buildLink(item.link));
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
