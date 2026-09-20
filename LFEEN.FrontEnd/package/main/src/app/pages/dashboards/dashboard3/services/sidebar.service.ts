import { Injectable, signal, effect, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, distinctUntilChanged, skip } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { LoginService } from './login/login.service';
import { SidebarItem } from '../interfaces/login.model';
import { CoreService } from '../../../../services/core.service';
import { PAGE_FLAGS } from '../../../../config/page-flags';

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

    // The backend doesn't send a Settlements entry in the sidebar payload, so it's added here.
    // Not gated on the Settlements.View permission yet: the environments' login response
    // doesn't carry it until the backend ships it — the API itself still answers 403 without it.
    if (PAGE_FLAGS['settlements'] && !items.find(i => i.link === '/d3/settlements')) {
      items.push({ translationKey: 'd3.sidebar.settlements', icon: 'receipt-2', link: '/d3/settlements' });
    }

    // Temporary fixed entry so the Contact Us page can be previewed before the
    // backend starts returning it in the permission-driven sidebar payload.
    if (!items.find(i => i.link === '/d3/contact-us')) {
      items.push({ translationKey: 'd3.sidebar.contactUs', icon: 'mail', link: '/d3/contact-us' });
    }

    // Temporary fixed entry, same as Contact Us above: the permission-driven
    // sidebar payload doesn't know about this page yet.
    if (!items.find(i => i.link === '/d3/platform-offers')) {
      items.push({ translationKey: 'd3.sidebar.platformOffers', icon: 'discount', link: '/d3/platform-offers' });
    }

    // Same as Settlements above: not gated on CallScripts.View yet since the
    // login response doesn't carry that permission — the API still enforces it.
    if (PAGE_FLAGS['call-scripts'] && !items.find(i => i.link === '/d3/call-scripts')) {
      items.push({ translationKey: 'd3.sidebar.callScripts', icon: 'phone-call', link: '/d3/call-scripts' });
    }

    if (!items.find(i => i.link === '/d3/subscriptions/management')) {
      const subscriptionChildren: NavItem[] = [
        { translationKey: 'd3.sidebar.subscriptionSettings', icon: 'adjustments', link: '/d3/subscriptions/settings' },
        { translationKey: 'd3.sidebar.subscriptionLog', icon: 'history', link: '/d3/subscriptions/log' },
      ];
      if (PAGE_FLAGS['subscriptions-management']) {
        subscriptionChildren.splice(1, 0, {
          translationKey: 'd3.sidebar.subscriptionManagement', icon: 'list-details', link: '/d3/subscriptions/management'
        });
      }
      items.push({
        translationKey: 'd3.sidebar.subscriptions',
        icon: 'credit-card',
        link: null,
        children: subscriptionChildren
      });
    }

    if (PAGE_FLAGS['settings'] && !items.find(i => i.link === '/d3/settings')) {
      items.push({ divider: true });
      items.push({ translationKey: 'd3.sidebar.settings', icon: 'settings', link: '/d3/settings' });
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
      'units':            'smart-home',
      'properties':       'building-skyscraper',
      'accounts':         'users',
      'bookings':         'calendar-time',
      'complaints':       'message-exclamation',
      'client-faq':       'help-circle',
      'contact-us':       'mail',
      'contactus':        'mail',
      'contact_us':       'mail'
    };

    const exactRouteMap: { [key: string]: string } = {
      'dashboard':       '/d3/ceo',
      'departments-all': '/d3/team-management',
      'admin-users':     '/d3/team-management?tab=employees',
      'settings':        '/d3/settings',
      'units':           '/d3/units',
      'properties':      '/d3/buildings',
      'accounts':        '/d3/account-management',
      'bookings':        '/d3/bookings',
      'complaints':      '/d3/complaints',
      'client-faq':      '/d3/client-faq',
      'contact-us':      '/d3/contact-us',
      'contactus':       '/d3/contact-us',
      'contact_us':      '/d3/contact-us',
      'roles':           '/d3/roles'
    };

    // Driven by page-flags.ts: a page with its flag set to false is hidden from
    // the sidebar here, and (where a route exists) blocked by page-flag.guard.ts.
    const hiddenKeys = new Set(
      Object.entries(PAGE_FLAGS)
        .filter(([, enabled]) => !enabled)
        .map(([key]) => key)
    );

    return items
      .filter(item => !hiddenKeys.has(item.key))
      .sort((a, b) => a.order - b.order)
      .map(item => {
        let link: string | null = null;
        if (exactRouteMap[item.key]) {
          link = exactRouteMap[item.key];
        } else if (item.key?.startsWith('department-')) {
          // Individual department links (e.g. department-it/cs/ops) go to that
          // department's page — not the disabled permissions module below.
          link = `/d3/team-management/${item.entityId ?? item.id}`;
        } else if (item.entityId) {
          link = `/d3/permissions/${item.entityId}`;
        } else if (item.route && !item.children?.length) {
          link = `/d3/permissions/${item.id}`;
        }

        return {
          id: item.id,
          key: item.key,
          title: item.title || '',
          icon: iconMap[item.key] || 'point',
          link,
          children: item.children?.length ? this.mapSidebarToNavItems(item.children) : undefined
        };
      });
  }
}
