import { Injectable, signal, effect, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, distinctUntilChanged, skip } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { LoginService } from './login/login.service';
import { SidebarItem } from '../interfaces/login.model';
import { CoreService } from '../../../../services/core.service';
import { PAGE_FLAGS } from '../../../../config/page-flags';
import { APP_RUNTIME_PERMISSIONS, hasAppRuntimePermission } from '../pages-d3/control-center/interfaces/control-center-permissions';

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

    // The backend doesn't send a Ban Refunds entry either (per the listing-ban handoff, the
    // frontend adds it). Unlike Settlements it's gated: BanRefunds.View ships in the login
    // response. Reading permissions() here also makes the effect rebuild when they change.
    const canViewBanRefunds = this.loginService.permissions().some(p => p.toLowerCase() === 'banrefunds.view');
    if (canViewBanRefunds && !items.find(i => i.link === '/d3/ban-refunds')) {
      items.push({ translationKey: 'd3.sidebar.banRefunds', icon: 'receipt-refund', link: '/d3/ban-refunds' });
    }

    // The backend doesn't send a Contact Us entry yet; gated on ContactUs.View like Ban Refunds.
    const canViewContactUs = this.loginService.permissions().some(p => p.toLowerCase() === 'contactus.view');
    if (canViewContactUs && !items.find(i => i.link === '/d3/contact-us')) {
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

    // The backend doesn't send an eSIM entry in the sidebar payload yet.
    if (PAGE_FLAGS['esim'] && !items.find(i => i.link === '/d3/esim')) {
      items.push({ translationKey: 'd3.sidebar.esim', icon: 'device-sim', link: '/d3/esim' });
    }

    if (!items.find(i => i.link === '/d3/subscriptions/management')) {
      // Order follows the design: settings, management, requests, discount codes, log.
      const subscriptionChildren: NavItem[] = [
        { translationKey: 'd3.sidebar.subscriptionSettings', icon: 'adjustments', link: '/d3/subscriptions/settings' },
        { translationKey: 'd3.sidebar.subscriptionRequests', icon: 'file-invoice', link: '/d3/subscriptions/requests' },
        { translationKey: 'd3.sidebar.discountCodes', icon: 'discount', link: '/d3/subscriptions/discount-codes' },
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

    // The payload is meant to carry a "control-center" entry for AppRuntime.View holders, but
    // some environments don't send it yet. Gated on AppRuntime.View once the login response
    // carries AppRuntime.* permissions; until then shown to all (the API still answers 403).
    // Reading permissions() here also makes the effect rebuild when they change.
    if (PAGE_FLAGS['control-center']
      && hasAppRuntimePermission(this.loginService, APP_RUNTIME_PERMISSIONS.view)
      && !items.find(i => i.link === '/d3/control-center')) {
      items.push({ divider: true });
      items.push({ translationKey: 'd3.sidebar.controlCenter', icon: 'layout-grid', link: '/d3/control-center' });
    }

    if (PAGE_FLAGS['settings'] && !items.find(i => i.link === '/d3/settings')) {
      // Settings shares the Control Center group in the design — one divider above both.
      if (items[items.length - 1]?.link !== '/d3/control-center') items.push({ divider: true });
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
      'operation-audits': 'history',
      'units':            'smart-home',
      'properties':       'building-skyscraper',
      'accounts':         'users',
      'bookings':         'calendar-time',
      'complaints':       'message-exclamation',
      'client-faq':       'help-circle',
      'contact-us':       'mail',
      'contactus':        'mail',
      'contact_us':       'mail',
      'control-center':   'layout-grid'
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
      'roles':           '/d3/roles',
      // Sent only to admins holding AppRuntime.View (the payload's own route is /admin/control-center).
      'control-center':  '/d3/control-center'
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
        } else if (/audit|^logs?$|(operation|ops|activity)s?[-_]?logs?/i.test(item.key ?? '')) {
          // The operations log lives as a tab inside team management.
          link = '/d3/team-management?tab=logs';
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
