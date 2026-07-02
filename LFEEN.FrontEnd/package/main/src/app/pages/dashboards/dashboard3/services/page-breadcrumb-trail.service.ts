import { Injectable, signal } from '@angular/core';

export interface PageBreadcrumbCrumb {
  // Either a translation key (translate: true) or a literal string (e.g. an entity name).
  label: string;
  translate?: boolean;
  route?: string[];
  // Use instead of `route` when the crumb's destination is the current URL itself (e.g.
  // build-review's sections are internal view-state, not real child routes) — a routerLink
  // back to the same URL is a no-op under Angular's default onSameUrlNavigation: 'ignore'.
  onClick?: () => void;
}

// Lets a routed page insert extra breadcrumb crumbs (e.g. "building name" then the static
// "Building Review" label) between the header's outer breadcrumb link and the H1 title,
// for pages that drill into a specific sub-section of an entity (build-review's internal
// photos/terms/license views, unit-review's basic-info/photos/... routes). dashboard3.component
// clears this on every route change.
@Injectable({
  providedIn: 'root'
})
export class PageBreadcrumbTrailService {
  private readonly _crumbs = signal<PageBreadcrumbCrumb[] | null>(null);
  readonly crumbs = this._crumbs.asReadonly();

  set(crumbs: PageBreadcrumbCrumb[] | null): void {
    this._crumbs.set(crumbs?.length ? crumbs : null);
  }

  clear(): void {
    this._crumbs.set(null);
  }
}
