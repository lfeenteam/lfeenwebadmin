import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { FullComponent } from './layouts/full/full.component';
import { LanguageRedirectGuard } from './guards/language-redirect.guard';

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
        component: FullComponent,
        children: [
          {
            path: '',
            redirectTo: 'dashboards/dashboard1',
            pathMatch: 'full',
          },
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
                redirectTo: 'ceo',
                pathMatch: 'full',
              },
              {
                path: 'ceo',
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/ceo-page/ceo-page.component'
                  ).then((m) => m.CeoPageComponent),
                data: { header: 'ceo' },
              },
              {
                path: 'buildings',
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-builds/all-builds.component'
                  ).then((m) => m.AllBuildsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.allBuilds.title',
                  breadcrumbKey: 'd3.header.platform',
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
