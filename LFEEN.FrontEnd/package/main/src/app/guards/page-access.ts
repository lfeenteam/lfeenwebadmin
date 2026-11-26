import { SidebarItem } from '../pages/dashboards/dashboard3/interfaces/login.model';

// Kept free of component/service imports: app.routes.ts loads this file eagerly.

/**
 * Who may open an admin page (BUG-2496). The backend only lists a page in the sidebar
 * payload when the admin holds that item's `requiredPermission`, and answers 403 to
 * everything else — so a page is open when EITHER:
 *  - its item is in the admin's sidebar payload, OR
 *  - the admin holds any permission of its module (e.g. `Bookings.View` → prefix `bookings`).
 * Either one is enough, so nobody loses a page they can already reach from the menu,
 * while an admin with neither (no permissions at all) is stopped before the page loads.
 */
export interface PageAccessRule {
  /** Sidebar payload keys (searched recursively). A RegExp matches a family of keys. */
  sidebarKeys?: (string | RegExp)[];
  /** Lower-case permission module prefixes, matched as `<prefix>.<anything>`. */
  permissionPrefixes?: string[];
}

// Same pattern sidebar.service.ts uses to send audit-log keys to team management's logs tab.
const AUDIT_LOG_KEY = /audit|^logs?$|(operation|ops|activity)s?[-_]?logs?/i;

const TEAM_MANAGEMENT: PageAccessRule = {
  sidebarKeys: [/^department/, 'admin-users', AUDIT_LOG_KEY],
  permissionPrefixes: ['departments', 'adminusers', 'operationaudits'],
};

const ROLES: PageAccessRule = {
  sidebarKeys: ['roles'],
  permissionPrefixes: ['roles'],
};

export const PAGE_ACCESS = {
  dashboard:        { sidebarKeys: ['dashboard'], permissionPrefixes: ['dashboard'] },
  buildings:        { sidebarKeys: ['properties'], permissionPrefixes: ['properties', 'buildings'] },
  units:            { sidebarKeys: ['units'], permissionPrefixes: ['units'] },
  teamManagement:   TEAM_MANAGEMENT,
  // Role editing is reached from both team management and the roles page.
  permissions:      { sidebarKeys: [...TEAM_MANAGEMENT.sidebarKeys!, ...ROLES.sidebarKeys!],
                      permissionPrefixes: [...TEAM_MANAGEMENT.permissionPrefixes!, ...ROLES.permissionPrefixes!] },
  roles:            ROLES,
  settlements:      { sidebarKeys: ['settlements'], permissionPrefixes: ['settlements'] },
  demoAccounts:     { sidebarKeys: ['demo-accounts'], permissionPrefixes: ['demoaccounts'] },
  esim:             { sidebarKeys: ['esim'], permissionPrefixes: ['esim'] },
  banRefunds:       { sidebarKeys: ['ban-refunds'], permissionPrefixes: ['banrefunds'] },
  accounts:         { sidebarKeys: ['accounts'], permissionPrefixes: ['accounts'] },
  // Its API lives under /api/{accounts|properties|units}/additional-conditions.
  additionalConditions: { sidebarKeys: ['additional-conditions'],
                          permissionPrefixes: ['additionalconditions', 'accounts', 'properties', 'units'] },
  wallet:           { permissionPrefixes: ['wallet'] },
  complaints:       { sidebarKeys: ['complaints'], permissionPrefixes: ['complaints', 'clienttickets', 'hosttickets', 'tickets'] },
  bookings:         { sidebarKeys: ['bookings'], permissionPrefixes: ['bookings'] },
  contactUs:        { sidebarKeys: ['contact-us', 'contactus', 'contact_us'], permissionPrefixes: ['contactus'] },
  platformOffers:   { sidebarKeys: ['platform-offers'], permissionPrefixes: ['platformoffers', 'offers'] },
  clientFaq:        { sidebarKeys: ['client-faq'], permissionPrefixes: ['clientfaq', 'faq', 'faqs'] },
  callScripts:      { sidebarKeys: ['call-scripts'], permissionPrefixes: ['callscripts'] },
  subscriptions:    { sidebarKeys: ['subscriptions'], permissionPrefixes: ['subscriptions'] },
} satisfies Record<string, PageAccessRule>;

export type PageAccessKey = keyof typeof PAGE_ACCESS;

function sidebarHasKey(items: SidebarItem[] | null | undefined, matchers: (string | RegExp)[]): boolean {
  for (const item of items ?? []) {
    const key = item?.key ?? '';
    if (key && matchers.some(m => (typeof m === 'string' ? m === key : m.test(key)))) return true;
    if (sidebarHasKey(item?.children, matchers)) return true;
  }
  return false;
}

/** Exact (case-insensitive) permission check, e.g. `hasPermission(perms, 'settings.manage')`. */
export function hasPermission(permissions: string[] | null | undefined, name: string): boolean {
  const wanted = name.toLowerCase();
  return (permissions ?? []).some(p => (p ?? '').toLowerCase() === wanted);
}

/**
 * Whether the admin holds any permission of the module(s) beyond read-only ones —
 * anything other than `<prefix>.view…` (BUG-2739). Gates create/edit/delete buttons
 * and routes whose exact backend permission name isn't known to the frontend: a
 * view-only admin sees none of them (the API would answer 403), while an admin holding
 * any write permission of the module keeps them whatever that permission is called —
 * the API still refuses an action they lack.
 */
export function canWriteModule(permissions: string[] | null | undefined, prefixes: string | string[]): boolean {
  const list = (Array.isArray(prefixes) ? prefixes : [prefixes]).map(p => p.toLowerCase());
  return (permissions ?? []).some(p => {
    const perm = (p ?? '').toLowerCase();
    return list.some(prefix => perm.startsWith(prefix + '.') && !perm.slice(prefix.length + 1).startsWith('view'));
  });
}

// Pages whose data call needs more than their module's view permission (BUG-2739).

/** The maker-checker queue (GET wallet/adjustments/pending) needs an approve permission. */
export function canOpenWalletApprovals(permissions: string[] | null | undefined): boolean {
  return (permissions ?? []).some(p => (p ?? '').toLowerCase().startsWith('wallet.approve'));
}

/** Demo sign-up links (/api/admin/demo-signup-links) aren't readable with DemoAccounts.View alone. */
export function canOpenDemoSignupLinks(permissions: string[] | null | undefined): boolean {
  return canAccessPage({ permissionPrefixes: ['demosignuplinks'] }, permissions, null)
    || hasPermission(permissions, 'demoaccounts.manage');
}

export function canAccessPage(
  rule: PageAccessRule,
  permissions: string[] | null | undefined,
  sidebar: SidebarItem[] | null | undefined,
): boolean {
  if (rule.sidebarKeys?.length && sidebarHasKey(sidebar, rule.sidebarKeys)) return true;
  const prefixes = rule.permissionPrefixes ?? [];
  if (!prefixes.length) return false;
  return (permissions ?? []).some(p => {
    const perm = (p ?? '').toLowerCase();
    return prefixes.some(prefix => perm.startsWith(prefix + '.'));
  });
}
