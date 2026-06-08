import { Injectable, signal, effect, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, distinctUntilChanged, skip } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { LoginService } from './login/login.service';
import { SidebarItem } from '../interfaces/login.model';
import { CoreService } from '../../../../services/core.service';

export interface NavItem {
  id?: string;
  key?: string;
  title?: string;
  translationKey?: string;
  icon?: string;
  link?: string | null;
  divider?: boolean;
  children?: NavItem[];
}

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private loginService = inject(LoginService);
  private coreService = inject(CoreService);

  sidebarItems = signal<NavItem[]>([]);

  constructor() {
    // rebuild whenever the sidebar signal updates (login or refresh)
    effect(() => {
      this.buildNavItems(this.loginService.sidebar());
    });

    // when language changes, refresh the token → server returns sidebar in new language
    toObservable(this.coreService.getOptionsSignal())
      .pipe(
        map(opts => opts.language),
        distinctUntilChanged(),
        skip(1)
      )
      .subscribe(() => {
        this.loginService.refreshToken().subscribe({ error: () => {} });
      });
  }

  private buildNavItems(dynamicSidebar: any[]): void {
    let items: NavItem[] = [];

    if (dynamicSidebar?.length) {
      items = this.mapSidebarToNavItems(dynamicSidebar);
    }

    const staticItems: NavItem[] = [
      { translationKey: 'd3.sidebar.buildings',         icon: 'building-skyscraper', link: '/d3/buildings' },
      { translationKey: 'd3.sidebar.units',             icon: 'smart-home',          link: '/d3/units' },
      { translationKey: 'd3.sidebar.accountManagement', icon: 'users',               link: '/d3/account-management' },
      { translationKey: 'd3.sidebar.bookings',          icon: 'calendar-time',       link: '/bookings' },
      { translationKey: 'd3.sidebar.complaints',        icon: 'message-exclamation', link: '/complaints' }
    ];

    staticItems.forEach(sItem => {
      if (!items.find(i => i.link === sItem.link)) {
        const dashIndex = items.findIndex(i => i.icon === 'layout-dashboard');
        if (dashIndex !== -1) {
          items.splice(dashIndex + 1, 0, sItem);
        } else {
          items.push(sItem);
        }
      }
    });

    if (!items.find(i => i.link === '/settings')) {
      items.push({ divider: true });
      items.push({ translationKey: 'd3.sidebar.settings', icon: 'settings', link: '/settings' });
    }

    this.sidebarItems.set(items);
  }

  getSidebarItems(): Observable<NavItem[]> {
    return of(this.sidebarItems());
  }

  private mapSidebarToNavItems(items: SidebarItem[]): NavItem[] {
    const iconMap: { [key: string]: string } = {
      'dashboard':        'layout-dashboard',
      'departments':      'building-skyscraper',
      'departments-all':  'list',
      'department-it':    'code',
      'department-cs':    'headset',
      'department-ops':   'briefcase',
      'users-management': 'users',
      'admin-users':      'user-cog',
      'roles':            'shield-check',
      'permissions':      'lock',
      'permission-groups':'layers-intersect'
    };

    const exactRouteMap: { [key: string]: string } = {
      'dashboard':       '/d3/ceo',
      'departments-all': '/d3/team-management',
    };

    return items
      .sort((a, b) => a.order - b.order)
      .map(item => {
        let link: string | null = null;
        if (exactRouteMap[item.key]) {
          link = exactRouteMap[item.key];
        } else if (item.route && !item.children?.length) {
          link = `/d3/team-management/${item.id}`;
        }

        return {
          id: item.id,
          key: item.key,
          // title comes from server in the correct language via Accept-Language
          title: item.title || item.titleEn || item.titleAr || '',
          icon: iconMap[item.key] || 'point',
          link,
          children: item.children?.length ? this.mapSidebarToNavItems(item.children) : undefined
        };
      });
  }
}
