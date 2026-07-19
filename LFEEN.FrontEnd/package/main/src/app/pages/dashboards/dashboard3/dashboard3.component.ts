import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { SidebarComponent } from '../../../components/dashboard3/sidebar/sidebar.component';
import { HeaderComponent } from '../../../components/dashboard3/header/header.component';
import { PageHeaderComponent } from '../../../components/dashboard3/page-header/page-header.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { filter, Subscription } from 'rxjs';
import { CoreService } from '../../../services/core.service';
import { D3HeaderType, D3RouteHeaderData } from './interfaces/dashboard3-header.model';
import { ComplaintService } from './pages-d3/complaint-management/services/complaint.service';
import { PageBackOverrideService } from './services/page-back-override.service';
import { PageTitleOverrideService } from './services/page-title-override.service';
import { PageBreadcrumbTrailService } from './services/page-breadcrumb-trail.service';
import { ClientSupportHubService } from './services/client-support-hub.service';

@Component({
  selector: 'app-dashboard3',
  standalone: true,
  imports: [
    SidebarComponent,
    HeaderComponent,
    PageHeaderComponent,
    RouterModule,
    CommonModule,
    FormsModule,
    MaterialModule,
  ],
  templateUrl: './dashboard3.component.html',
  styleUrl: './dashboard3.component.scss',
})
export class AppDashboard3Component implements OnInit, OnDestroy {
  private settings = inject(CoreService);

  // Sourced from CoreService's signal (not translate.currentLang) so the dir
  // attribute — which the sidebar/header/every routed page inherit from —
  // updates the instant the language changes, instead of waiting on a getter
  // to be re-checked by change detection (which a lang switch doesn't reliably trigger).
  readonly currentDir = computed(() => this.settings.getOptionsSignal()().dir);

  sidebarCollapsed = false;
  sidebarMobileOpen = false;

  headerType: D3HeaderType = 'ceo';
  pageTitleKey = '';
  pageBreadcrumbKey = 'd3.header.platform';
  pageBreadcrumbRoute: string[] | null = null;
  pageBreadcrumbQueryParams: Record<string, string> | null = null;
  pageShowLive = true;
  pageShowDate = true;
  pageShowBack = false;
  pageStatusBadge: { text: string; color: string } | null = null;
  pageActionButton: { text: string; icon?: string; color?: string; action: string } | null = null;

  isLoginRoute = false;

  private routeSub?: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private complaintService: ComplaintService,
    private pageBackOverride: PageBackOverrideService,
    private pageTitleOverride: PageTitleOverrideService,
    private pageBreadcrumbTrail: PageBreadcrumbTrailService,
    private clientSupportHub: ClientSupportHubService
  ) {}

  get pageTitleOverrideText(): string | null {
    return this.pageTitleOverride.title();
  }

  get pageExtraCrumbs() {
    return this.pageBreadcrumbTrail.crumbs();
  }

  ngOnInit(): void {
    this.updateIsLoginRoute();
    this.applyRouteHeaderData();
    this.connectHubIfAuthenticated();
    this.routeSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateIsLoginRoute();
        this.applyRouteHeaderData();
        this.connectHubIfAuthenticated();
      });
  }

  private connectHubIfAuthenticated(): void {
    if (!this.isLoginRoute) {
      this.clientSupportHub.connect();
    }
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.clientSupportHub.disconnect();
  }

  private updateIsLoginRoute(): void {
    this.isLoginRoute = this.router.url.includes('/login');
  }

  private applyRouteHeaderData(): void {
    this.pageTitleOverride.clear();
    this.pageBreadcrumbTrail.clear();
    let child = this.route.firstChild;
    while (child?.firstChild) {
      child = child.firstChild;
    }
    const data = (child?.snapshot.data ?? {}) as D3RouteHeaderData;
    const isViewOnly = child?.snapshot.queryParamMap.get('mode') === 'view';

    this.headerType = data.header ?? 'page';
    this.pageTitleKey = data.titleKey ?? '';
    this.pageBreadcrumbKey = data.breadcrumbKey ?? 'd3.header.platform';
    this.pageShowLive = data.showLive ?? true;
    this.pageShowDate = data.showDate ?? true;
    this.pageShowBack = data.showBack ?? false;
    this.pageStatusBadge = isViewOnly ? null : (data.statusBadge ?? null);
    this.pageActionButton = isViewOnly ? null : (data.actionButton ?? null);

    if (data.breadcrumbRoute) {
      const lang = this.route.snapshot.parent?.params['lang'] ?? 'ar';
      const params = child?.snapshot.paramMap;
      const resolved = data.breadcrumbRoute.replace(/:(\w+)/g, (_, key) => params?.get(key) ?? key);
      this.pageBreadcrumbRoute = ['/', lang, 'd3', ...resolved.split('/')];

      // Carry the current page's own `tab` query param (e.g. complaints/:id?tab=hosts)
      // into the breadcrumb link — otherwise clicking it always lands back on the
      // complaints list's default 'customers' tab, regardless of which tab you came from.
      const tab = child?.snapshot.queryParamMap.get('tab');
      this.pageBreadcrumbQueryParams = tab ? { tab } : null;
    } else {
      this.pageBreadcrumbRoute = null;
      this.pageBreadcrumbQueryParams = null;
    }
  }

  toggleMobileSidebar(): void {
    this.sidebarMobileOpen = !this.sidebarMobileOpen;
  }

  closeMobileSidebar(): void {
    this.sidebarMobileOpen = false;
  }

  onPageBack(): void {
    if (this.pageBackOverride.consume()) return;
    window.history.back();
  }

  onPageAction(action: string): void {
    if (action !== 'resolveComplaint') return;
    this.complaintService.emitCloseDialog();
  }
}
