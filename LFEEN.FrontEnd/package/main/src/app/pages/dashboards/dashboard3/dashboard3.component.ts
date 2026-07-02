import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { SidebarComponent } from '../../../components/dashboard3/sidebar/sidebar.component';
import { HeaderComponent } from '../../../components/dashboard3/header/header.component';
import { PageHeaderComponent } from '../../../components/dashboard3/page-header/page-header.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TranslateService } from '@ngx-translate/core';
import { filter, Subscription } from 'rxjs';
import { D3HeaderType, D3RouteHeaderData } from './interfaces/dashboard3-header.model';
import { ComplaintService } from './pages-d3/complaint-management/services/complaint.service';
import { PageBackOverrideService } from './services/page-back-override.service';
import { PageTitleOverrideService } from './services/page-title-override.service';
import { PageBreadcrumbTrailService } from './services/page-breadcrumb-trail.service';

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
  sidebarCollapsed = false;
  sidebarMobileOpen = false;

  headerType: D3HeaderType = 'ceo';
  pageTitleKey = '';
  pageBreadcrumbKey = 'd3.header.platform';
  pageBreadcrumbRoute: string[] | null = null;
  pageShowLive = true;
  pageShowDate = true;
  pageShowBack = false;
  pageStatusBadge: { text: string; color: string } | null = null;
  pageActionButton: { text: string; icon?: string; color?: string; action: string } | null = null;

  isLoginRoute = false;

  private routeSub?: Subscription;

  constructor(
    private translate: TranslateService,
    private router: Router,
    private route: ActivatedRoute,
    private complaintService: ComplaintService,
    private pageBackOverride: PageBackOverrideService,
    private pageTitleOverride: PageTitleOverrideService,
    private pageBreadcrumbTrail: PageBreadcrumbTrailService
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
    this.routeSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateIsLoginRoute();
        this.applyRouteHeaderData();
      });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
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
    } else {
      this.pageBreadcrumbRoute = null;
    }
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
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
