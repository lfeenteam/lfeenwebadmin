import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { LoginService } from './login/login.service';
import { SidebarItem } from './login/login.model';

export interface NavItem {
  title?: string;
  titleAr?: string;
  titleEn?: string;
  icon?: string;
  link?: string | null;
  divider?: boolean;
  children?: NavItem[];
}

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private apiUrl = '/api/sidebar/items';

  // Using signals for sidebar items
  sidebarItems = signal<NavItem[]>([]);

  constructor(private http: HttpClient, private loginService: LoginService) {
    this.loadSidebarItems();
  }

  loadSidebarItems(): void {
    const dynamicSidebar = this.loginService.getSidebar();
    let items: NavItem[] = [];

    if (dynamicSidebar && dynamicSidebar.length > 0) {
      items = this.mapSidebarToNavItems(dynamicSidebar);
    }

    // Add static items that might be missing from API
    const staticItems: NavItem[] = [
      { title: 'd3.sidebar.buildings', icon: 'building-skyscraper', link: '/d3/buildings' },
      { title: 'd3.sidebar.units', icon: 'smart-home', link: '/d3/units' },
      { title: 'd3.sidebar.bookings', icon: 'calendar-time', link: '/bookings' },
      { title: 'd3.sidebar.complaints', icon: 'message-exclamation', link: '/complaints' }
    ];

    // Merge logic: Add static items if they don't exist by link
    staticItems.forEach(sItem => {
      if (!items.find(i => i.link === sItem.link)) {
        // Insert after dashboard if possible
        const dashIndex = items.findIndex(i => i.icon === 'layout-dashboard');
        if (dashIndex !== -1) {
          items.splice(dashIndex + 1, 0, sItem);
        } else {
          items.push(sItem);
        }
      }
    });

    // Add Settings at the bottom
    if (!items.find(i => i.link === '/settings')) {
      items.push({ divider: true });
      items.push({ title: 'd3.sidebar.settings', icon: 'settings', link: '/settings' });
    }

    this.sidebarItems.set(items);
  }

  getSidebarItems(): Observable<NavItem[]> {
    return of(this.sidebarItems());
  }

  private mapSidebarToNavItems(items: SidebarItem[]): NavItem[] {
    // Map of keys to static icons
    const iconMap: { [key: string]: string } = {
      'dashboard': 'layout-dashboard',
      'departments': 'building-skyscraper',
      'departments-all': 'list',
      'department-it': 'code',
      'department-cs': 'headset',
      'department-ops': 'briefcase',
      'users-management': 'users',
      'admin-users': 'user-cog',
      'roles': 'shield-check',
      'permissions': 'lock',
      'permission-groups': 'layers-intersect'
    };

    // Map of API routes to App routes
    const routeMap: { [key: string]: string } = {
      'dashboard': '/d3/ceo',
      'departments-all': '/d3/team-management',
      'department-it': '/d3/team-management',
      'department-cs': '/d3/team-management',
      'department-ops': '/d3/team-management',
      'admin-users': '/d3/team-management',
      'roles': '/d3/team-management',
      'permissions': '/d3/team-management',
      'permission-groups': '/d3/team-management'
    };

    return items
      .sort((a, b) => a.order - b.order)
      .map(item => ({
        titleAr: item.titleAr,
        titleEn: item.titleEn,
        icon: iconMap[item.key] || 'point',
        link: routeMap[item.key] || item.route,
        children: item.children && item.children.length > 0 ? this.mapSidebarToNavItems(item.children) : undefined
      }));
  }
}
