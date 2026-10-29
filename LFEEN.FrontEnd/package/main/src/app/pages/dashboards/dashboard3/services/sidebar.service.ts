import { Injectable, signal, effect, inject } from '@angular/core';
import { EMPTY, Observable, of } from 'rxjs';
import { map, distinctUntilChanged, skip, filter, switchMap, catchError } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { LoginService } from './login/login.service';
import { SidebarItem } from '../interfaces/login.model';
import { CoreService } from '../../../../services/core.service';
import { PAGE_FLAGS } from '../../../../config/page-flags';
import { SETTINGS_PERMISSIONS, hasSettingsPermission } from '../interfaces/platform-settings.model';

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

    // when language changes, refetch the sidebar → server returns it in the new language.
    // switchMap drops a stale response if the language is toggled again mid-request.
    toObservable(this.coreService.getOptionsSignal())
      .pipe(
        map(opts => opts.language),
        distinctUntilChanged(),
        skip(1),
        filter(() => this.loginService.isLoggedIn()),
        switchMap(() => this.loginService.reloadSidebar().pipe(catchError(() => EMPTY)))
      )
      .subscribe();
  }

  private buildNavItems(dynamicSidebar: any[]): void {
    let items: NavItem[] = [];

    if (dynamicSidebar?.length) {
      items = this.mapSidebarToNavItems(dynamicSidebar);
    }

    // The additional-conditions review queue has no sidebar key in the payload yet;
    // add it after Units until the backend sends one (mapped in exactRouteMap).
    if (PAGE_FLAGS['additional-conditions'] && !items.find(i => i.link === '/d3/additional-conditions')) {
      const unitsIndex = items.findIndex(i => i.link === '/d3/units');
      items.splice(unitsIndex >= 0 ? unitsIndex + 1 : items.length, 0, {
        key: 'additional-conditions',
        translationKey: 'd3.sidebar.additionalConditions',
        icon: 'list-check',
        link: '/d3/additional-conditions'
      });
    }

    // Every page entry now comes from the backend payload, already filtered by the
    // user's permissions — no frontend fallbacks. Control Center and Settings form the
    // last group in the design, so Control Center is moved to the end, below a divider.
    const controlCenterIndex = items.findIndex(i => i.link === '/d3/control-center');
    const controlCenter = controlCenterIndex >= 0 ? items.splice(controlCenterIndex, 1)[0] : null;
    if (controlCenter) {
      items.push({ divider: true }, controlCenter);
    }

    // Settings isn't in the payload; it's a frontend-only page, shown only with Settings.View.
    const canViewSettings = hasSettingsPermission(this.loginService, SETTINGS_PERMISSIONS.view);
    items = items.filter(i => i.link !== '/d3/settings' || canViewSettings);
    if (PAGE_FLAGS['settings'] && canViewSettings && !items.find(i => i.link === '/d3/settings')) {
      if (!controlCenter) items.push({ divider: true });
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
      'control-center':   'layout-grid',
      'settlements':      'receipt-2',
      'ban-refunds':      'receipt-refund',
      'platform-offers':  'discount',
      'call-scripts':     'phone-call',
      'additional-conditions': 'list-check',
      'esim':             'device-sim',
      'subscriptions':    'credit-card'
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
      'control-center':  '/d3/control-center',
      'settlements':     '/d3/settlements',
      'ban-refunds':     '/d3/ban-refunds',
      'platform-offers': '/d3/platform-offers',
      'call-scripts':    '/d3/call-scripts',
      'esim':            '/d3/esim',
      'additional-conditions': '/d3/additional-conditions'
    };

    // Labels come from the payload's title; these keys are only the fallback for an
    // item that arrives without one.
    const fallbackTranslationMap: { [key: string]: string } = {
      'dashboard':       'd3.sidebar.dashboard',
      'client-faq':      'd3.sidebar.faq',
      'complaints':      'd3.sidebar.complaints',
      'bookings':        'd3.sidebar.bookings',
      'accounts':        'd3.sidebar.accountManagement',
      'properties':      'd3.sidebar.buildings',
      'units':           'd3.sidebar.units',
      'control-center':  'd3.sidebar.controlCenter',
      'settlements':     'd3.sidebar.settlements',
      'ban-refunds':     'd3.sidebar.banRefunds',
      'contact-us':      'd3.sidebar.contactUs',
      'platform-offers': 'd3.sidebar.platformOffers',
      'call-scripts':    'd3.sidebar.callScripts',
      'additional-conditions': 'd3.sidebar.additionalConditions',
      'esim':            'd3.sidebar.esim',
      'subscriptions':   'd3.sidebar.subscriptions'
    };

    // The payload sends Subscriptions as a single entry; its pages are a frontend group.
    // Order follows the design: settings, management, requests, discount codes, log.
    const subscriptionChildren = (): NavItem[] => [
      { translationKey: 'd3.sidebar.subscriptionSettings', icon: 'adjustments', link: '/d3/subscriptions/settings' },
      ...(PAGE_FLAGS['subscriptions-management']
        ? [{ translationKey: 'd3.sidebar.subscriptionManagement', icon: 'list-details', link: '/d3/subscriptions/management' }]
        : []),
      { translationKey: 'd3.sidebar.subscriptionRequests', icon: 'file-invoice', link: '/d3/subscriptions/requests' },
      { translationKey: 'd3.sidebar.discountCodes', icon: 'discount', link: '/d3/subscriptions/discount-codes' },
      { translationKey: 'd3.sidebar.subscriptionLog', icon: 'history', link: '/d3/subscriptions/log' },
    ];

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
      .map((item): NavItem | null => {
        if (item.key === 'subscriptions') {
          return {
            id: item.id,
            key: item.key,
            title: item.title || '',
            translationKey: fallbackTranslationMap[item.key],
            icon: iconMap[item.key],
            link: null,
            children: subscriptionChildren()
          };
        }

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
        }

        const children = item.children?.length ? this.mapSidebarToNavItems(item.children) : undefined;

        // A key with no known page (and no children to open) would be a dead link — hide it
        // until it's added to exactRouteMap above.
        if (!link && !children?.length) return null;

        return {
          id: item.id,
          key: item.key,
          title: item.title || '',
          translationKey: fallbackTranslationMap[item.key],
          icon: iconMap[item.key] || 'point',
          link,
          children
        };
      })
      .filter((item): item is NavItem => item !== null);
  }
}
