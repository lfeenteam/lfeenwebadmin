import { Routes } from '@angular/router';
import { BlankComponent } from './layouts/blank/blank.component';
import { LanguageRedirectGuard } from './guards/language-redirect.guard';
import { languageSyncGuard, languageSyncChildGuard } from './guards/language-sync.guard';
import { authGuard, guestGuard } from './guards/auth.guard';
import { pageFlagGuard } from './guards/page-flag.guard';
import { appRuntimeViewGuard } from './guards/app-runtime-view.guard';
import { settingsViewGuard } from './guards/settings-view.guard';
import { cancellationRefundsViewGuard } from './guards/cancellation-refunds-view.guard';
import { settlementDebtsRedirectGuard } from './guards/settlement-debts-redirect.guard';
import { pageAccessGuard, pageWriteGuard, permissionGuard } from './guards/page-access.guard';
import { canOpenDemoSignupLinks, canOpenWalletApprovals, hasPermission } from './guards/page-access';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';
import {
  agreementsViewGuard,
  unsavedAgreementGuard,
} from './pages/dashboards/dashboard3/pages-d3/agreements/guards/agreement-guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [LanguageRedirectGuard],
    component: BlankComponent
  },
  {
    path: ':lang',
    canActivate: [languageSyncGuard],
    canActivateChild: [languageSyncChildGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'd3/login',
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
                canActivate: [guestGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/login/login.component'
                  ).then((m) => m.LoginComponent),
              },
              {
                path: 'forgot-password',
                canActivate: [guestGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/forgot-password/forgot-password.component'
                  ).then((m) => m.ForgotPasswordComponent),
                data: { titleKey: 'd3.forgotPasswordPage.title' },
              },
              {
                // Linked from the reset email: #/{lang}/d3/reset-password?email=...&token=...
                // No guestGuard: the emailed link must work even in a browser that is still signed in.
                path: 'reset-password',
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/reset-password/reset-password.component'
                  ).then((m) => m.ResetPasswordComponent),
                data: { titleKey: 'd3.resetPasswordPage.title' },
              },
              {
                path: 'ceo',
                canActivate: [authGuard, pageFlagGuard('dashboard'), pageAccessGuard('dashboard')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/ceo-page/ceo-page.component'
                  ).then((m) => m.CeoPageComponent),
                data: { header: 'ceo' },
              },
              {
                path: 'buildings',
                canActivate: [authGuard, pageAccessGuard('buildings')],
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
                canActivate: [authGuard, pageAccessGuard('units')],
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
              // A review page without a building id has nothing to show — send it to the list
              // instead of rendering an empty review (truncated link, stale bookmark).
              {
                path: 'build-review',
                redirectTo: 'buildings',
                pathMatch: 'full',
              },
              {
                path: 'build-review/:id',
                canActivate: [authGuard, pageAccessGuard('buildings')],
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
                  recreateOnParamChange: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/basic-info',
                canActivate: [authGuard, pageAccessGuard('units')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/basic-info-review/basic-info-review.component'
                  ).then((m) => m.BasicInfoReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.basicInfoView.pageTitle',
                  recreateOnParamChange: true,
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/photos',
                canActivate: [authGuard, pageAccessGuard('units')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-images-review/unit-images-review.component'
                  ).then((m) => m.UnitImagesReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.imagesView.pageTitle',
                  recreateOnParamChange: true,
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/terms',
                canActivate: [authGuard, pageAccessGuard('units')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-terms-review/unit-terms-review.component'
                  ).then((m) => m.UnitTermsReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.termsView.pageTitle',
                  recreateOnParamChange: true,
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/pricing',
                canActivate: [authGuard, pageAccessGuard('units')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-pricing-review/unit-pricing-review.component'
                  ).then((m) => m.UnitPricingReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.pricingView.pageTitle',
                  recreateOnParamChange: true,
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/access',
                canActivate: [authGuard, pageAccessGuard('units')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-access-review/unit-access-review.component'
                  ).then((m) => m.UnitAccessReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.accessView.pageTitle',
                  recreateOnParamChange: true,
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/cancel-policy',
                canActivate: [authGuard, pageAccessGuard('units')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/cancel-policy-review/cancel-policy-review.component'
                  ).then((m) => m.CancelPolicyReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.cancelPolicyView.pageTitle',
                  recreateOnParamChange: true,
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/deposit',
                canActivate: [authGuard, pageAccessGuard('units')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-deposit-review/unit-deposit-review.component'
                  ).then((m) => m.UnitDepositReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.depositView.pageTitle',
                  recreateOnParamChange: true,
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/services',
                canActivate: [authGuard, pageAccessGuard('units')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-services-review/unit-services-review.component'
                  ).then((m) => m.UnitServicesReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.servicesView.pageTitle',
                  recreateOnParamChange: true,
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId/license',
                canActivate: [authGuard, pageAccessGuard('units')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/components/unit-license-review/unit-license-review.component'
                  ).then((m) => m.UnitLicenseReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.licenseView.pageTitle',
                  recreateOnParamChange: true,
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'unit-review/:buildingId/:unitId',
                canActivate: [authGuard, pageAccessGuard('units')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/all-units/unit-review/unit-review.component'
                  ).then((m) => m.UnitReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.unitReview.title',
                  recreateOnParamChange: true,
                  breadcrumbKey: 'd3.unitReview.reviewRequestsBC',
                  breadcrumbRoute: 'units',
                  showBack: true,
                },
              },
              {
                path: 'team-management',
                canActivate: [authGuard, pageAccessGuard('teamManagement')],
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
                canActivate: [authGuard, pageFlagGuard('add-department'), pageAccessGuard('teamManagement'), pageWriteGuard('departments')],
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
                canActivate: [authGuard, pageAccessGuard('teamManagement')],
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
                path: 'settlements',
                canActivate: [authGuard, pageFlagGuard('settlements'), pageAccessGuard('settlements')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/settlements/settlements.component'
                  ).then((m) => m.SettlementsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.settlements.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: true,
                  showDate: true
                },
              },
              {
                // Merchant debts now live in a tab of Settlements; the old address
                // (and its ?accountId= filter) still opens that tab.
                path: 'settlement-debts',
                pathMatch: 'full',
                canActivate: [settlementDebtsRedirectGuard],
                children: [],
              },
              {
                path: 'demo-accounts',
                canActivate: [authGuard, pageFlagGuard('demo-accounts'), pageAccessGuard('demoAccounts')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/demo-accounts/demo-accounts.component'
                  ).then((m) => m.DemoAccountsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.demoAccounts.title',
                  breadcrumbKey: 'd3.header.platform',
                  showDate: true
                },
              },
              // These must stay above 'demo-accounts/:id', or "new" / "activation-requests" would be read as an id.
              ...['demo-accounts/activation-requests', 'demo-accounts/activation-requests/:requestId'].map(path => ({
                path,
                canActivate: [authGuard, pageFlagGuard('demo-accounts'), pageAccessGuard('demoAccounts')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/demo-accounts/activation-requests/activation-requests.component'
                  ).then((m) => m.ActivationRequestsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.demoAccounts.activation.title',
                  breadcrumbKey: 'd3.demoAccounts.title',
                  breadcrumbRoute: 'demo-accounts',
                  showDate: true
                },
              })),
              // Demo sign-up links (MUL-0004) — also above 'demo-accounts/:id'.
              {
                path: 'demo-accounts/signup-links',
                canActivate: [authGuard, pageFlagGuard('demo-accounts'), pageAccessGuard('demoAccounts'), permissionGuard(canOpenDemoSignupLinks)],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/demo-accounts/demo-signup-links/signup-links-list/signup-links-list.component'
                  ).then((m) => m.SignupLinksListComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.demoAccounts.signupLinks.list.title',
                  breadcrumbKey: 'd3.demoAccounts.title',
                  breadcrumbRoute: 'demo-accounts',
                  showDate: true
                },
              },
              {
                path: 'demo-accounts/signup-links/new',
                canActivate: [authGuard, pageFlagGuard('demo-accounts'), pageAccessGuard('demoAccounts'), permissionGuard(canOpenDemoSignupLinks)],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/demo-accounts/demo-signup-links/signup-links-create/signup-links-create.component'
                  ).then((m) => m.SignupLinksCreateComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.demoAccounts.signupLinks.create.title',
                  breadcrumbKey: 'd3.demoAccounts.signupLinks.list.title',
                  breadcrumbRoute: 'demo-accounts/signup-links',
                  showBack: true
                },
              },
              {
                path: 'demo-accounts/new',
                canActivate: [authGuard, pageFlagGuard('demo-accounts'), pageAccessGuard('demoAccounts'), permissionGuard(p => hasPermission(p, 'demoaccounts.manage'))],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/demo-accounts/demo-account-create/demo-account-create.component'
                  ).then((m) => m.DemoAccountCreateComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.demoAccounts.create.title',
                  breadcrumbKey: 'd3.demoAccounts.title',
                  breadcrumbRoute: 'demo-accounts',
                  showBack: true
                },
              },
              {
                path: 'demo-accounts/:id/resend',
                canActivate: [authGuard, pageFlagGuard('demo-accounts'), pageAccessGuard('demoAccounts'), permissionGuard(p => hasPermission(p, 'demoaccounts.manage'))],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/demo-accounts/demo-account-resend/demo-account-resend.component'
                  ).then((m) => m.DemoAccountResendComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.demoAccounts.dialogs.resend.title',
                  breadcrumbKey: 'd3.demoAccounts.title',
                  breadcrumbRoute: 'demo-accounts',
                  showBack: true,
                  recreateOnParamChange: true
                },
              },
              {
                path: 'demo-accounts/:id',
                canActivate: [authGuard, pageFlagGuard('demo-accounts'), pageAccessGuard('demoAccounts')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/demo-accounts/demo-account-details/demo-account-details.component'
                  ).then((m) => m.DemoAccountDetailsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.demoAccounts.detailsTitle',
                  breadcrumbKey: 'd3.demoAccounts.title',
                  breadcrumbRoute: 'demo-accounts',
                  showBack: true,
                  recreateOnParamChange: true
                },
              },
              {
                path: 'esim',
                canActivate: [authGuard, pageFlagGuard('esim'), pageAccessGuard('esim')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/esim/esim.component'
                  ).then((m) => m.EsimComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.esim.title',
                  breadcrumbKey: 'd3.header.platform',
                  showDate: true
                },
              },
              {
                path: 'control-center',
                // authGuard first: it may refresh the token, which reloads the permissions.
                canActivate: [authGuard, pageFlagGuard('control-center'), appRuntimeViewGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/control-center/control-center.component'
                  ).then((m) => m.ControlCenterComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.controlCenter.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: false
                },
              },
              {
                path: 'ban-refunds',
                canActivate: [authGuard, pageAccessGuard('banRefunds')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/ban-refunds/ban-refunds.component'
                  ).then((m) => m.BanRefundsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.banRefunds.title',
                  breadcrumbKey: 'd3.header.platform',
                  showDate: true
                },
              },
              {
                path: 'cancellation-refunds',
                // authGuard first: it may refresh the token, which reloads the permissions.
                canActivate: [authGuard, cancellationRefundsViewGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/cancellation-refunds/cancellation-refunds.component'
                  ).then((m) => m.CancellationRefundsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.cancellationRefunds.title',
                  breadcrumbKey: 'd3.header.platform',
                  showDate: true
                },
              },
              {
                path: 'agreements',
                // authGuard first: it may refresh the token, which reloads the permissions.
                canActivate: [authGuard, agreementsViewGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/agreements/agreements-list.component'
                  ).then((m) => m.AgreementsListComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.agreements.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: true
                },
              },
              {
                path: 'agreements/:id',
                canActivate: [authGuard, agreementsViewGuard],
                canDeactivate: [unsavedAgreementGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/agreements/agreement-page.component'
                  ).then((m) => m.AgreementPageComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.agreements.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: true
                },
              },
              {
                path: 'account-management',
                canActivate: [authGuard, pageAccessGuard('accounts')],
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
                canActivate: [authGuard, pageAccessGuard('accounts')],
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
                // Opened from the "profile changes" tab of account management.
                path: 'account-management/profile-changes/:accountId',
                canActivate: [authGuard, pageFlagGuard('profile-changes'), pageAccessGuard('accounts')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/profile-changes/profile-change-review/profile-change-review.component'
                  ).then((m) => m.ProfileChangeReviewComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.profileChanges.reviewTitle',
                  breadcrumbKey: 'd3.accountManagement.title',
                  breadcrumbRoute: 'account-management',
                  showBack: true
                },
              },
              {
                path: 'additional-conditions',
                canActivate: [authGuard, pageFlagGuard('additional-conditions'), pageAccessGuard('additionalConditions')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/additional-conditions-pending/additional-conditions-pending.component'
                  ).then((m) => m.AdditionalConditionsPendingComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.additionalConditions.pendingTitle',
                  breadcrumbKey: 'd3.header.platform',
                  showDate: true
                },
              },
              {
                path: 'wallet-approvals',
                canActivate: [authGuard, pageFlagGuard('wallet-approvals'), pageAccessGuard('wallet'), permissionGuard(canOpenWalletApprovals)],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/wallet/wallet-approvals/wallet-approvals.component'
                  ).then((m) => m.WalletApprovalsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.wallet.approvals.title',
                  breadcrumbKey: 'd3.header.platform',
                  showDate: true
                },
              },
              {
                path: 'wallet/:id',
                canActivate: [authGuard, pageFlagGuard('wallet'), pageAccessGuard('wallet')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/wallet/wallet.component'
                  ).then((m) => m.WalletComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.wallet.title',
                  breadcrumbKey: 'd3.accountManagement.title',
                  breadcrumbRoute: 'account-management',
                  showBack: true
                },
              },
              {
                path: 'permissions/:id',
                canActivate: [authGuard, pageFlagGuard('permissions'), pageAccessGuard('permissions')],
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
                canActivate: [authGuard, pageFlagGuard('permissions'), pageAccessGuard('permissions'), pageWriteGuard('roles')],
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
                canActivate: [authGuard, pageFlagGuard('permissions'), pageAccessGuard('permissions')],
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
                canActivate: [authGuard, pageAccessGuard('roles')],
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
              // Permissions & permission-group management pages removed from routing —
              // permissions come ready from the backend and are not edited in the frontend.
              // Components kept on disk under pages-d3/all-permissions & pages-d3/permission-groups.
              {
                path: 'roles/add',
                canActivate: [authGuard, pageAccessGuard('roles'), pageWriteGuard('roles')],
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
                canActivate: [authGuard, pageAccessGuard('roles')],
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
                canActivate: [authGuard, pageAccessGuard('complaints'), pageWriteGuard(['complaints', 'clienttickets', 'hosttickets', 'tickets'])],
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
                // A complaint against an employee (api/complaints) — not a ticket, so it
                // has its own read-only page and no "Close & resolve" button (BUG-2813).
                path: 'complaints/employee/:id',
                canActivate: [authGuard, pageAccessGuard('complaints')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/complaint-management/components/employee-complaint-detail/employee-complaint-detail.component'
                  ).then((m) => m.EmployeeComplaintDetailComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.complaints.employeeDetail.title',
                  breadcrumbKey: 'd3.complaints.title',
                  breadcrumbRoute: 'complaints',
                  showBack: true,
                  showLive: false,
                  showDate: true,
                },
              },
              {
                path: 'complaints/:id',
                canActivate: [authGuard, pageAccessGuard('complaints')],
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
                  // "Close & resolve" lives in the page itself, beside the ticket number.
                },
              },
              {
                path: 'complaints',
                canActivate: [authGuard, pageAccessGuard('complaints')],
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
                canActivate: [authGuard, pageAccessGuard('bookings')],
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
                path: 'contact-us',
                canActivate: [authGuard, pageAccessGuard('contactUs')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/contact-us-management/contact-us-management.component'
                  ).then((m) => m.ContactUsManagementComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.contactUs.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: true
                },
              },
              {
                path: 'platform-offers',
                canActivate: [authGuard, pageAccessGuard('platformOffers')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/platform-offers/platform-offers-list.component'
                  ).then((m) => m.PlatformOffersListComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.platformOffers.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: true
                },
              },
              {
                path: 'platform-offers/create',
                canActivate: [authGuard, pageAccessGuard('platformOffers'), pageWriteGuard(['platformoffers', 'offers'])],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/platform-offers/platform-offer-form.component'
                  ).then((m) => m.PlatformOfferFormComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.platformOffers.form.createTitle',
                  breadcrumbKey: 'd3.platformOffers.title',
                  breadcrumbRoute: 'platform-offers',
                  showLive: false,
                  showDate: false,
                  showBack: true
                },
              },
              {
                path: 'platform-offers/:id',
                canActivate: [authGuard, pageAccessGuard('platformOffers')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/platform-offers/platform-offer-detail.component'
                  ).then((m) => m.PlatformOfferDetailComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.platformOffers.title',
                  breadcrumbKey: 'd3.platformOffers.title',
                  breadcrumbRoute: 'platform-offers',
                  showLive: false,
                  showDate: false,
                  showBack: true
                },
              },
              {
                path: 'platform-offers/:id/edit',
                canActivate: [authGuard, pageAccessGuard('platformOffers'), pageWriteGuard(['platformoffers', 'offers'])],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/platform-offers/platform-offer-form.component'
                  ).then((m) => m.PlatformOfferFormComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.platformOffers.form.editTitle',
                  breadcrumbKey: 'd3.platformOffers.title',
                  breadcrumbRoute: 'platform-offers',
                  showLive: false,
                  showDate: false,
                  showBack: true
                },
              },
              {
                path: 'client-faq',
                canActivate: [authGuard, pageAccessGuard('clientFaq')],
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
                // Service (worker) app FAQ — BUG-2453 / TAS-2317.
                // The service (worker) app FAQ is a tab of the FAQ page (TAS-2317); old links land on it.
                path: 'service-faq',
                pathMatch: 'full',
                redirectTo: 'client-faq?tab=service',
              },
              {
                path: 'call-scripts',
                canActivate: [authGuard, pageFlagGuard('call-scripts'), pageAccessGuard('callScripts')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/call-scripts/call-scripts.component'
                  ).then((m) => m.CallScriptsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.callScripts.title',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: true
                },
              },
              {
                path: 'subscriptions/management',
                canActivate: [authGuard, pageFlagGuard('subscriptions-management'), pageAccessGuard('subscriptions')],
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
                canActivate: [authGuard, pageAccessGuard('subscriptions')],
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
                path: 'subscriptions/requests',
                canActivate: [authGuard, pageAccessGuard('subscriptions')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/subscriptions/subscription-requests/subscription-requests.component'
                  ).then((m) => m.SubscriptionRequestsComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.subscriptionRequests.pageTitle',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: true
                },
              },
              {
                path: 'subscriptions/discount-codes',
                canActivate: [authGuard, pageAccessGuard('subscriptions')],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/subscriptions/subscription-discount-codes/subscription-discount-codes.component'
                  ).then((m) => m.SubscriptionDiscountCodesComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.discountCodes.pageTitle',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: true
                },
              },
              {
                path: 'subscriptions/settings',
                canActivate: [authGuard, pageAccessGuard('subscriptions')],
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
                canActivate: [authGuard, pageAccessGuard('subscriptions')],
                canDeactivate: [unsavedChangesGuard],
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
                canActivate: [authGuard, pageFlagGuard('settings'), settingsViewGuard],
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
                canActivate: [authGuard, pageFlagGuard('notifications')],
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
              {
                // Where permission guards send an admin who may not open a page (BUG-2496).
                path: 'no-access',
                canActivate: [authGuard],
                loadComponent: () =>
                  import(
                    './pages/dashboards/dashboard3/pages-d3/no-access/no-access.component'
                  ).then((m) => m.NoAccessComponent),
                data: {
                  header: 'page',
                  titleKey: 'd3.noAccess.pageTitle',
                  breadcrumbKey: 'd3.header.platform',
                  showLive: false,
                  showDate: false,
                },
              },
            ],
          },
          {
            path: 'authentication/error',
            loadComponent: () =>
              import('./pages/authentication/error/error.component').then(
                (m) => m.AppErrorComponent
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
