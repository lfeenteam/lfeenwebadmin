import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { LanguageRedirectGuard } from './guards/language-redirect.guard';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [LanguageRedirectGuard],
    component: BlankComponent
  },
  {
    path: ':lang',
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'd3/login',
      },
      {
        path: '',
        component: FullComponent,
        children: [
          {
            path: 'starter',
            loadChildren: () =>
              import('./pages/pages.routes').then((m) => m.PagesRoutes),
          },
          {
            path: 'dashboards',
            loadChildren: () =>
              import('./pages/dashboards/dashboards.routes').then(
                (m) => m.DashboardsRoutes
              ),
          },
          {
            path: 'forms',
            loadChildren: () =>
              import('./pages/forms/forms.routes').then((m) => m.FormsRoutes),
          },
          {
            path: 'charts',
            loadChildren: () =>
              import('./pages/charts/charts.routes').then((m) => m.ChartsRoutes),
          },
          {
            path: 'apps',
            loadChildren: () =>
              import('./pages/apps/apps.routes').then((m) => m.AppsRoutes),
          },
          {
            path: 'widgets',
            loadChildren: () =>
              import('./pages/widgets/widgets.routes').then((m) => m.WidgetsRoutes),
          },
          {
            path: 'tables',
            loadChildren: () =>
              import('./pages/tables/tables.routes').then((m) => m.TablesRoutes),
          },
          {
            path: 'datatable',
            loadChildren: () =>
              import('./pages/datatable/datatable.routes').then(
                (m) => m.DatatablesRoutes
              ),
          },
          {
            path: 'theme-pages',
            loadChildren: () =>
              import('./pages/theme-pages/theme-pages.routes').then(
                (m) => m.ThemePagesRoutes
              ),
          },
          {
            path: 'ui-components',
            loadChildren: () =>
              import('./pages/ui-components/ui-components.routes').then(
                (m) => m.UiComponentsRoutes
              ),
          },
        ],
      },
      {
        path: '',
        component: BlankComponent,
        children: [
          {
            path: 'd3',
            loadComponent: () =>
              import('./pages/dashboards/dashboard3/dashboard3.component').then(
                (m) => m.AppDashboard3Component
              ),
            children: [
              {
                path: '',
                redirectTo: 'login',
                pathMatch: 'full',
              },
              {
                path: 'login',
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/login/login.component'
                  ).then((m) => m.LoginComponent),
              },
              {
                path: 'ceo',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/ceo-page/ceo-page.component'
                  ).then((m) => m.CeoPageComponent),
                data: { header: 'ceo' },
              },
              {
                path: 'buildings',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-builds/all-builds.component'
                  ).then((m) => m.AllBuildsComponent),
                data: {
                  header: 'page',
                  titleKey: 'كل المباني',
                  breadcrumbKey: 'المنصة',
                  showLive: true,
                  showDate: true
                },
              },
              {
                path: 'units',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/all-units.component'
                  ).then((m) => m.AllUnitsComponent),
                data: {
                  header: 'page',
                  titleKey: 'كل الوحدات',
                  breadcrumbKey: 'المنصة',
                  showLive: true,
                  showDate: true
                },
              },
              {
                path: 'build-review',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/build-review/build-review.component'
                  ).then((m) => m.BuildReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.buildReview.title',
                  breadcrumbKey: 'd3.header.platform',
                },
              },
              {
                path: 'build-review/:id',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/build-review/build-review.component'
                  ).then((m) => m.BuildReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'مراجعة برج ريتاج السكني',
                  breadcrumbKey: 'طلبات المراجعة',
                  showBack: true,
                  statusBadge: { text: 'طلب عاجل', color: '#DC2626' }
                },
              },
              {
                path: 'team-management',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/team-management/team-management.component'
                  ).then((m) => m.TeamManagementComponent),
                data: {
                  header: 'page',
                  titleKey: 'إدارة الفريق والمسؤولين',
                  breadcrumbKey: 'المنصة',
                  showLive: true,
                  showDate: true
                },
              },
              {
                path: 'team-management/add',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/team-management/components/add-department/add-department.component'
                  ).then((m) => m.AddDepartmentComponent),
                data: {
                  header: 'page',
                  titleKey: 'إضافة قسم جديد',
                  breadcrumbKey: 'إدارة الفريق',
                  showBack: true
                },
              },
              {
                path: 'team-management/:id',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/team-management/team-management.component'
                  ).then((m) => m.TeamManagementComponent),
                data: {
                  header: 'page',
                  titleKey: 'إدارة الفريق',
                  breadcrumbKey: 'إدارة الفريق',
                  showLive: true,
                  showDate: true,
                  showBack: true
                },
              },
              {
                path: 'permissions/:id',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/permissions/permissions.component'
                  ).then((m) => m.PermissionsComponent),
                data: {
                  header: 'page',
                  titleKey: 'صلاحيات القسم',
                  breadcrumbKey: 'إدارة الفريق',
                  showBack: true
                },
              },
            ],
          },
          {
            path: 'authentication',
            loadChildren: () =>
              import('./pages/authentication/authentication.routes').then(
                (m) => m.AuthenticationRoutes
              ),
          },
          {
            path: 'landingpage',
            loadChildren: () =>
              import('./pages/theme-pages/landingpage/landingpage.routes').then(
                (m) => m.LandingPageRoutes
              ),
          },
        ],
      },
      {
        path: '**',
        redirectTo: 'authentication/error',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
