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
                  titleKey: 'd3.allBuilds.title',
                  breadcrumbKey: 'd3.header.platform',
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
                  titleKey: 'd3.allUnits.title',
                  breadcrumbKey: 'd3.header.platform',
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
                  titleKey: 'd3.buildReview.title',
                  breadcrumbKey: 'd3.buildReview.reviewRequestsBC',
                  breadcrumbRoute: 'buildings',
                  showBack: true,
                  statusBadge: { text: 'd3.buildReview.urgentRequest', color: '#DC2626' }
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/basic-info',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/basic-info-review/basic-info-review.component'
                  ).then((m) => m.BasicInfoReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.basicInfoView.pageTitle',
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/photos',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-images-review/unit-images-review.component'
                  ).then((m) => m.UnitImagesReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.imagesView.pageTitle',
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/terms',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-terms-review/unit-terms-review.component'
                  ).then((m) => m.UnitTermsReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.termsView.pageTitle',
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/pricing',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-pricing-review/unit-pricing-review.component'
                  ).then((m) => m.UnitPricingReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.pricingView.pageTitle',
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/access',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-access-review/unit-access-review.component'
                  ).then((m) => m.UnitAccessReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.accessView.pageTitle',
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/cancel-policy',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/cancel-policy-review/cancel-policy-review.component'
                  ).then((m) => m.CancelPolicyReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.cancelPolicyView.pageTitle',
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/deposit',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-deposit-review/unit-deposit-review.component'
                  ).then((m) => m.UnitDepositReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.depositView.pageTitle',
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/services',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-services-review/unit-services-review.component'
                  ).then((m) => m.UnitServicesReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.servicesView.pageTitle',
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/license',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-license-review/unit-license-review.component'
                  ).then((m) => m.UnitLicenseReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.licenseView.pageTitle',
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/unit-review.component'
                  ).then((m) => m.UnitReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.title',
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
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
                  titleKey: 'd3.teamManagement.title',
                  breadcrumbKey: 'd3.header.platform',
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
                  titleKey: 'd3.teamManagement.addDept',
                  breadcrumbKey: 'd3.teamManagement.title',
                  breadcrumbRoute: 'team-management',
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
                  titleKey: 'd3.teamManagement.title',
                  breadcrumbKey: 'd3.teamManagement.title',
                  breadcrumbRoute: 'team-management',
                  showLive: true,
                  showDate: true,
                  showBack: true
                },
              },
              {
                path: 'account-management',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/account-management/account-management.component'
                  ).then((m) => m.AccountManagementComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.accountManagement.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: true,
                  showDate: true
                },
              },
              {
                path: 'account-management/review/:id',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/account-management/components/review-account/review-account.component'
                  ).then((m) => m.ReviewAccountComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.accountManagement.reviewTitle',
                  breadcrumbKey: 'd3.accountManagement.title',
                  breadcrumbRoute: 'account-management',
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
                  titleKey: 'd3.permissions.pageTitle',
                  breadcrumbKey: 'd3.teamManagement.title',
                  breadcrumbRoute: 'team-management/:id',
                  showBack: true
                },
              },
              {
                path: 'permissions/:id/add-role',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/permissions/add-role/add-role.component'
                  ).then((m) => m.AddRoleComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.addRolePage.title',
                  breadcrumbKey: 'd3.permissions.roleSettingsTitle',
                  breadcrumbRoute: 'permissions/:id',
                  showBack: true
                },
              },
              {
                path: 'permissions/:id/role/:roleId',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/permissions/role-permissions/role-permissions.component'
                  ).then((m) => m.RolePermissionsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.permissions.roleSettingsTitle',
                  breadcrumbKey: 'd3.permissions.pageTitle',
                  breadcrumbRoute: 'permissions/:id',
                  showBack: true
                },
              },
              {
                path: 'roles',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/roles/roles.component'
                  ).then((m) => m.RolesComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.rolesPage.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: true,
                  showDate: true
                },
              },
              {
                path: 'permission-groups',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/permission-groups/permission-groups.component'
                  ).then((m) => m.PermissionGroupsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.permissionGroupsPage.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: true,
                  showDate: true
                },
              },
              {
                path: 'all-permissions',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-permissions/all-permissions.component'
                  ).then((m) => m.AllPermissionsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.allPermissionsPage.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: true,
                  showDate: true
                },
              },
              {
                path: 'all-permissions/:id/dependencies',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-permissions/permission-dependencies/permission-dependencies.component'
                  ).then((m) => m.PermissionDependenciesComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.permissionDependenciesPage.title',
                  breadcrumbKey: 'd3.allPermissionsPage.title',
                  breadcrumbRoute: 'all-permissions',
                  showBack: true
                },
              },
              {
                path: 'roles/add',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/permissions/add-role/add-role.component'
                  ).then((m) => m.AddRoleComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.addRolePage.title',
                  breadcrumbKey: 'd3.rolesPage.title',
                  breadcrumbRoute: 'roles',
                  showBack: true
                },
              },
              {
                path: 'roles/:roleId',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/permissions/role-permissions/role-permissions.component'
                  ).then((m) => m.RolePermissionsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.permissions.roleSettingsTitle',
                  breadcrumbKey: 'd3.rolesPage.title',
                  breadcrumbRoute: 'roles',
                  showBack: true
                },
              },
              {
                path: 'complaints/:id/assign',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/complaint-management/components/assign-employee-page/assign-employee-page.component'
                  ).then((m) => m.AssignEmployeePageComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.complaints.assignDialog.title',
                  breadcrumbKey: 'd3.complaints.title',
                  breadcrumbRoute: 'complaints',
                  showBack: true,
                  showLive: false,
                  showDate: false,
                },
              },
              {
                path: 'complaints/:id',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/complaint-management/components/host-complaint-detail/host-complaint-detail.component'
                  ).then((m) => m.HostComplaintDetailComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.complaints.title',
                  breadcrumbKey: 'd3.complaints.title',
                  breadcrumbRoute: 'complaints',
                  showBack: true,
                  showLive: false,
                  showDate: true,
                  actionButton: {
                    text: 'd3.complaints.chat.resolveBtn',
                    icon: 'circle-check',
                    color: '#16803A',
                    action: 'resolveComplaint'
                  }
                },
              },
              {
                path: 'complaints',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/complaint-management/complaint-management.component'
                  ).then((m) => m.ComplaintManagementComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.complaints.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: true
                },
              },
              {
                path: 'bookings',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-bookings/all-bookings.component'
                  ).then((m) => m.AllBookingsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.bookings.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: true
                },
              },
              {
                path: 'faq',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/faq-management/faq-management.component'
                  ).then((m) => m.FaqManagementComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.faq.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: true
                },
              },
              {
                path: 'subscriptions/management',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/subscriptions/subscription-management/subscription-management.component'
                  ).then((m) => m.SubscriptionManagementComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.subscriptions.pageTitle',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: true
                },
              },
              {
                path: 'subscriptions/log',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/subscriptions/subscription-log/subscription-log.component'
                  ).then((m) => m.SubscriptionLogComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.subscriptionLog.pageTitle',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: true
                },
              },
              {
                path: 'subscriptions/settings',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/subscriptions/subscription-settings/subscription-settings.component'
                  ).then((m) => m.SubscriptionSettingsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.subscriptions.settings.pageTitle',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: false
                },
              },
              {
                path: 'subscriptions/settings/:id',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/subscriptions/subscription-service-settings/subscription-service-settings.component'
                  ).then((m) => m.SubscriptionServiceSettingsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.subscriptions.serviceSettings.pageTitle',
                  breadcrumbKey: 'd3.subscriptions.settings.pageTitle',
                  breadcrumbRoute: 'subscriptions/settings',
                  showLive: false,
                  showDate: false,
                  showBack: true
                },
              },
              {
                path: 'settings',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/platform-settings/platform-settings.component'
                  ).then((m) => m.PlatformSettingsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.settings.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: false
                },
              },
              {
                path: 'profile',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/profile/profile.component'
                  ).then((m) => m.ProfileComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.profile.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: false
                },
              },
              {
                path: 'notifications',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/notifications/notifications.component'
                  ).then((m) => m.NotificationsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.notifications.pageTitle',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: false,
                  showBack: true,
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
