import { Component, EventEmitter, HostBinding, Input, OnInit, Output } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { Router, RouterModule } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NavItem, SidebarService } from '../../../pages/dashboards/dashboard3/services/sidebar.service';

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

  navItems: NavItem[] = [];

  constructor(private router: Router, private sidebarService: SidebarService) {}

  ngOnInit(): void {
    this.sidebarService.getSidebarItems().subscribe({
      next: (items) => {
        this.navItems = items;
      },
      error: () => {
        // Fallback or handle error
        this.navItems = [
          { title: 'd3.sidebar.dashboard', icon: 'layout-dashboard', link: '/d3/ceo' },
          { title: 'd3.sidebar.buildings', icon: 'building-skyscraper', link: '/d3/buildings' },
          { title: 'd3.sidebar.units', icon: 'smart-home', link: '/units' },
          { title: 'd3.sidebar.bookings', icon: 'calendar-time', link: '/bookings' },
          { title: 'd3.sidebar.complaints', icon: 'message-exclamation', link: '/complaints' },
          { title: 'd3.sidebar.customers', icon: 'users', link: '/d3/team-management' },
          { divider: true },
          { title: 'd3.sidebar.settings', icon: 'settings', link: '/settings' },
        ];
      }
    });
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
}
