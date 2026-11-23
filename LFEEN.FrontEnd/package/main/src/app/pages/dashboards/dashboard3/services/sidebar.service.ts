import { Injectable, signal, effect, inject } from '@angular/core';
import { EMPTY, Observable, of } from 'rxjs';
import { map, distinctUntilChanged, filter, switchMap, catchError } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { LoginService } from './login/login.service';
import { SidebarItem } from '../interfaces/login.model';
import { CoreService } from '../../../../services/core.service';
import { PAGE_FLAGS } from '../../../../config/page-flags';
import { SETTINGS_PERMISSIONS, hasSettingsPermission } from '../interfaces/platform-settings.model';
import { canApproveWalletAdjustments } from '../pages-d3/wallet/interfaces/wallet.model';
import { PAGE_ACCESS, canAccessPage } from '../../../../guards/page-access';

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

    // Refetch whenever the page language differs from the stored sidebar's — the server
    // translates the titles. That covers a header toggle and also a page opened straight
    // on another language's URL (e.g. #/en/... after logging in on Arabic), where the URL
    // language is applied before this service exists.
    // switchMap drops a stale response if the language is toggled again mid-request.
    toObservable(this.coreService.getOptionsSignal())
      .pipe(
        map(opts => opts.language),
        distinctUntilChanged(),
        filter(lang => this.loginService.isLoggedIn() && lang !== this.loginService.getSidebarLanguage()),
        switchMap(() => this.loginService.reloadSidebar().pipe(catchError(() => EMPTY)))
      )
      .subscribe();
  }

  private buildNavItems(dynamicSidebar: any[]): void {
    this.sidebarItems.set(this.computeNavItems(dynamicSidebar));
  }

  /**
   * The page an admin lands on after signing in (BUG-2496): the dashboard when they may
   * open it (unchanged default), else the first page of their menu, else the
   * "no permission" page. Computed from the stored session, not from sidebarItems, so it
   * is right straight after login, before the rebuild effect has run.
   */
  landingUrl(lang: string): string {
    const prefix = `/${lang === 'en' ? 'en' : 'ar'}`;
    const sidebar = this.loginService.sidebar();
    if (PAGE_FLAGS['dashboard'] && canAccessPage(PAGE_ACCESS.dashboard, this.loginService.permissions(), sidebar)) {
      return `${prefix}/d3/ceo`;
    }
    const first = this.firstLink(this.computeNavItems(sidebar));
    return prefix + (first ?? '/d3/no-access');
  }

  private firstLink(items: NavItem[]): string | null {
    for (const item of items) {
      if (item.divider) continue;
      if (item.link && item.link !== '/d3/ceo') return item.link;
      const child = item.children?.length ? this.firstLink(item.children) : null;
      if (child) return child;
    }
    return null;
  }

  private computeNavItems(dynamicSidebar: any[]): NavItem[] {
    let items: NavItem[] = [];

    if (dynamicSidebar?.length) {
      items = this.mapSidebarToNavItems(dynamicSidebar);
    }

    // The additional-conditions review queue has no sidebar key in the payload yet;
    // add it after Units until the backend sends one (mapped in exactRouteMap).
    // Only for admins who may open it — same rule as its route guard (BUG-2496).
    if (
      PAGE_FLAGS['additional-conditions']
      && canAccessPage(PAGE_ACCESS.additionalConditions, this.loginService.permissions(), dynamicSidebar)
      && !items.find(i => i.link === '/d3/additional-conditions')
    ) {
      const unitsIndex = items.findIndex(i => i.link === '/d3/units');
      items.splice(unitsIndex >= 0 ? unitsIndex + 1 : items.length, 0, {
        key: 'additional-conditions',
        translationKey: 'd3.sidebar.additionalConditions',
        icon: 'list-check',
        link: '/d3/additional-conditions'
      });
    }

    // The wallet approvals queue isn't in the payload; shown only to admins who can approve.
    // Placed after Settlements, the other money-movement page.
    if (
      PAGE_FLAGS['wallet-approvals']
      && canApproveWalletAdjustments(this.loginService.permissions())
      && !items.find(i => i.link === '/d3/wallet-approvals')
    ) {
      const settlementsIndex = items.findIndex(i => i.link === '/d3/settlements');
      items.splice(settlementsIndex >= 0 ? settlementsIndex + 1 : items.length, 0, {
        key: 'wallet-approvals',
        translationKey: 'd3.sidebar.walletApprovals',
        icon: 'shield-check',
        link: '/d3/wallet-approvals'
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

    return items;
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
      'service-faq':      'tool',
      'contact-us':       'mail',
      'contactus':        'mail',
      'contact_us':       'mail',
      'control-center':   'layout-grid',
      'settlements':      'receipt-2',
      'ban-refunds':      'receipt-refund',
      'cancellation-refunds': 'receipt-refund',
      'agreements':       'file-certificate',
      'platform-offers':  'discount',
      'call-scripts':     'phone-call',
      'additional-conditions': 'list-check',
      'esim':             'device-sim',
      'subscriptions':    'credit-card',
      'demo-accounts':    'flask'
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
      // The worker app FAQ is a tab of the FAQ page; only used if the payload ever sends this key.
      'service-faq':     '/d3/client-faq?tab=service',
      'contact-us':      '/d3/contact-us',
      'contactus':       '/d3/contact-us',
      'contact_us':      '/d3/contact-us',
      'roles':           '/d3/roles',
      // Sent only to admins holding AppRuntime.View (the payload's own route is /admin/control-center).
      'control-center':  '/d3/control-center',
      'settlements':     '/d3/settlements',
      'ban-refunds':     '/d3/ban-refunds',
      // Sent only to admins holding CancellationRefunds.View (the payload's own route is /admin/cancellation-refunds).
      'cancellation-refunds': '/d3/cancellation-refunds',
      // Sent only to admins holding Agreements.View (the payload's own route is /admin/agreements).
      'agreements':      '/d3/agreements',
      'platform-offers': '/d3/platform-offers',
      'call-scripts':    '/d3/call-scripts',
      'esim':            '/d3/esim',
      'additional-conditions': '/d3/additional-conditions',
      // Sent only to admins holding DemoAccounts.View (the payload's own route is /admin/demo-accounts).
      'demo-accounts':   '/d3/demo-accounts'
    };

    // Labels come from the payload's title; these keys are only the fallback for an
    // item that arrives without one.
    const fallbackTranslationMap: { [key: string]: string } = {
      'dashboard':       'd3.sidebar.dashboard',
      'client-faq':      'd3.sidebar.faq',
      'service-faq':     'd3.sidebar.serviceFaq',
      'complaints':      'd3.sidebar.complaints',
      'bookings':        'd3.sidebar.bookings',
      'accounts':        'd3.sidebar.accountManagement',
      'properties':      'd3.sidebar.buildings',
      'units':           'd3.sidebar.units',
      'control-center':  'd3.sidebar.controlCenter',
      'settlements':     'd3.sidebar.settlements',
      'ban-refunds':     'd3.sidebar.banRefunds',
      'cancellation-refunds': 'd3.sidebar.cancellationRefunds',
      'agreements':      'd3.sidebar.agreements',
      'contact-us':     'd3.sidebar.contactUs',
      'platform-offers': 'd3.sidebar.platformOffers',
      'call-scripts':    'd3.sidebar.callScripts',
      'additional-conditions': 'd3.sidebar.additionalConditions',
      'esim':            'd3.sidebar.esim',
      'subscriptions':   'd3.sidebar.subscriptions',
      'demo-accounts':   'd3.sidebar.demoAccounts'
    };

    // The payload's titles for these arrive mis-cased ("Esim", "Client Faq"), so the
    // frontend translation is used instead (TAS-1816).
    const localTitleKeys = new Set(['esim', 'client-faq']);
    const titleFor = (item: SidebarItem): string =>
      localTitleKeys.has(item.key) ? '' : item.title || '';

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
            title: titleFor(item),
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
          title: titleFor(item),
          translationKey: fallbackTranslationMap[item.key],
          icon: iconMap[item.key] || 'point',
          link,
          children
        };
      })
      .filter((item): item is NavItem => item !== null);
  }
}
