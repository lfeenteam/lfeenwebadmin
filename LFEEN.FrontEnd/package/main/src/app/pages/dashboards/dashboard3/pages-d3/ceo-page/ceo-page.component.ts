import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CardsTopComponent } from '../../../../../components/dashboard3/cards-top/cards-top.component';
import { ChartComponent } from '../../../../../components/dashboard3/chart/chart.component';
import { InsightsComponent } from '../../../../../components/dashboard3/insights/insights.component';
import { RevealDirective } from '../../../../../components/dashboard3/reveal/reveal.directive';
import { PeriodFilterComponent } from '../../../../../components/dashboard3/period-filter/period-filter.component';
import { DashboardEmptyComponent } from '../../../../../components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardAccessService } from '../../services/dashboard-widgets';
import { NavItem, SidebarService } from '../../services/sidebar.service';
import { CARD_STYLES } from '../../../../../components/dashboard3/cards-top/cards-top.styles';

/** Tailwind classes for the page (literal strings, so Tailwind generates them). */
const PAGE_STYLES = {
  ...CARD_STYLES,
  shortcut:
    'tw-group tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-4 tw-py-3 tw-rounded-tile tw-bg-white ' +
    'tw-border tw-border-solid tw-border-line tw-text-ink tw-font-bold tw-no-underline tw-shadow-card ' +
    'tw-transition-[transform,box-shadow,border-color] tw-duration-hover tw-ease-soft ' +
    'can-hover:hover:-tw-translate-y-0.5 can-hover:hover:tw-border-ink can-hover:hover:tw-shadow-card-hover ' +
    'focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-ink/25',
} as const;

/** Analytics row: chart 8 / decisions 4, or one full-width card when only one is allowed. */
const ANALYTICS_GRID = {
  pair: 'tw-grid-cols-[minmax(0,2fr)_minmax(0,1fr)] max-[1199px]:tw-grid-cols-1',
  single: 'tw-grid-cols-1',
};

/** Details row by how many panels this admin may see (an odd third spans the row on 2 columns). */
const DETAILS_GRID: Record<number, string> = {
  3: 'tw-grid-cols-3 max-[1279px]:tw-grid-cols-2 max-[1279px]:[&>:nth-child(3)]:tw-col-span-2 max-md:tw-grid-cols-1 max-md:[&>:nth-child(3)]:tw-col-span-1',
  2: 'tw-grid-cols-2 max-md:tw-grid-cols-1',
  1: 'tw-grid-cols-[minmax(0,760px)] max-md:tw-grid-cols-1',
};

interface ShortcutLink {
  link: string;
  title?: string;
  translationKey?: string;
}

/** How many of the admin's own pages the no-statistics state offers. */
const MAX_SHORTCUTS = 6;

@Component({
  selector: 'app-ceo-page',
  standalone: true,
  imports: [
    CommonModule, RouterModule, TranslateModule, RevealDirective, PeriodFilterComponent,
    CardsTopComponent, ChartComponent, InsightsComponent, DashboardEmptyComponent,
  ],
  templateUrl: './ceo-page.component.html',
  styleUrl: './ceo-page.component.scss'
})
export class CeoPageComponent {
  private readonly translate = inject(TranslateService);
  private readonly sidebar = inject(SidebarService);
  readonly access = inject(DashboardAccessService);

  // Every flag below comes from the widget registry, so a section whose widgets the admin
  // may not see is never rendered — its components are never created and never fetch.
  readonly hasOverview = computed(() => this.access.inSection('overview').length > 0);
  readonly showGrowth = computed(() => this.access.can('growthChart'));
  readonly showDecisions = computed(() => this.access.can('executiveInsights'));
  readonly hasAnalytics = computed(() => this.showGrowth() || this.showDecisions());
  readonly hasApps = computed(() =>
    this.access.inSection('hosts').length > 0 || this.access.inSection('guests').length > 0
  );
  readonly showRevenueSources = computed(() => this.access.can('revenueSources'));
  readonly showComparison = computed(() => this.access.can('hostGuestComparison'));
  readonly showCities = computed(() => this.access.can('topCities'));
  readonly detailsCount = computed(() => this.access.inSection('details').length);
  readonly hasAny = computed(() => this.access.visible().length > 0);

  readonly S = PAGE_STYLES;
  readonly analyticsGridClass = computed(() =>
    this.showGrowth() && this.showDecisions() ? ANALYTICS_GRID.pair : ANALYTICS_GRID.single
  );
  readonly detailsGridClass = computed(() => DETAILS_GRID[this.detailsCount()] ?? DETAILS_GRID[3]);

  /** The admin's own pages (from the server-filtered sidebar), for the no-statistics state. */
  readonly shortcuts = computed<ShortcutLink[]>(() =>
    leafLinks(this.sidebar.sidebarItems()).filter((l) => l.link !== '/d3/ceo').slice(0, MAX_SHORTCUTS)
  );

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get langPrefix(): string {
    return this.translate.currentLang === 'en' ? '/en' : '/ar';
  }
}

function leafLinks(items: NavItem[]): ShortcutLink[] {
  const out: ShortcutLink[] = [];
  for (const item of items) {
    if (item.divider) continue;
    if (item.children?.length) out.push(...leafLinks(item.children));
    else if (item.link) out.push({ link: item.link, title: item.title, translationKey: item.translationKey });
  }
  return out;
}
