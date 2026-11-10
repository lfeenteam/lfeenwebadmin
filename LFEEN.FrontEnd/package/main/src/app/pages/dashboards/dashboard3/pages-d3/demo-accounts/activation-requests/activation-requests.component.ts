import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription, of, switchMap } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatLocalizedNumber, getVisiblePages } from 'src/app/utils/pagination.util';
import { LoginService } from '../../../services/login/login.service';
import { DemoAccountsService } from '../../../services/demo-accounts.service';
import {
  ACTIVATION_STATUSES,
  ActivationRequest,
  ActivationRequestStatus,
  DEMO_PERMISSIONS,
  toLocalPhone
} from '../../../interfaces/demo-account.model';
import { demoErrorMessage, formatRiyadhDate, readDemoError } from '../demo-accounts.util';
import { DemoTabsComponent } from '../components/demo-tabs/demo-tabs.component';
import {
  ActivationRequestDialogComponent,
  ActivationRequestDialogData,
  ActivationRequestDialogResult
} from '../components/activation-request-dialog/activation-request-dialog.component';

const PAGE_SIZE = 20;
/** Pages of 100 to scan when a notification opens a request that isn't on the current page. */
const FIND_PAGE_SIZE = 100;
const FIND_MAX_PAGES = 10;

// /demo-accounts/activation-requests[/:requestId] — demo hosts who asked for a real
// account. Filter and page live in the URL; :requestId (from a notification) opens
// that request on load. There is no endpoint for one request, so it is looked up in the list.
@Component({
  selector: 'app-activation-requests',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent, DemoTabsComponent],
  templateUrl: './activation-requests.component.html',
  styleUrls: ['../demo-accounts.component.scss', './activation-requests.component.scss']
})
export class ActivationRequestsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly toastr = inject(ToastrService);
  private readonly service = inject(DemoAccountsService);
  private readonly login = inject(LoginService);

  readonly canManage = computed(() =>
    this.login.permissions().some(p => p.toLowerCase() === DEMO_PERMISSIONS.manage)
  );

  readonly statuses = ACTIVATION_STATUSES;
  readonly allStatuses = 'all';
  readonly pageSize = PAGE_SIZE;

  currentLang = this.translate.currentLang || 'ar';

  status: ActivationRequestStatus | null = null;
  page = 1;

  items: ActivationRequest[] = [];
  totalCount = 0;
  totalPages = 1;
  loading = false;
  loadError: string | null = null;

  /** From the route (a notification); opened once the list is in. */
  private pendingOpenId: string | null = null;
  private listRequest?: Subscription;
  private dialogOpen = false;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.pendingOpenId = params.get('requestId');
      if (this.pendingOpenId && !this.loading && this.items.length) this.openPending();
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const status = params.get('status') as ActivationRequestStatus | null;
      const page = Number(params.get('page'));
      this.status = status && ACTIVATION_STATUSES.includes(status) ? status : null;
      this.page = Number.isInteger(page) && page > 0 ? page : 1;
      this.load();
    });
  }

  get dir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.page, this.totalPages);
  }

  load(): void {
    this.listRequest?.unsubscribe();
    this.loading = true;
    this.loadError = null;

    this.listRequest = this.service.listActivationRequests({
      status: this.status,
      pageNumber: this.page,
      pageSize: this.pageSize,
    }).subscribe({
      next: res => {
        this.items = res.items ?? [];
        this.totalCount = res.totalCount ?? 0;
        this.totalPages = Math.max(1, res.totalPages ?? 1);
        this.loading = false;
        if (!this.items.length && this.page > this.totalPages) {
          this.updateQuery({ page: this.totalPages > 1 ? this.totalPages : null });
          return;
        }
        if (this.pendingOpenId) this.openPending();
      },
      error: err => {
        this.items = [];
        this.totalCount = 0;
        this.totalPages = 1;
        this.loading = false;
        // 403 (no DemoAccounts.View) → the usual "no permission" text.
        this.loadError = demoErrorMessage(readDemoError(err), this.translate);
      },
    });
  }

  onStatusChange(value: string): void {
    this.updateQuery({ status: value === this.allStatuses ? null : value, page: null });
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) return;
    this.updateQuery({ page: page === 1 ? null : page });
  }

  clearFilters(): void {
    this.updateQuery({ status: null, page: null });
  }

  // ── Details dialog ────────────────────────────────────────

  open(request: ActivationRequest): void {
    if (this.dialogOpen) return;
    this.dialogOpen = true;

    const ref = this.dialog.open(ActivationRequestDialogComponent, {
      width: '720px',
      maxWidth: '94vw',
      disableClose: true, // the dialog closes itself so it can hand back the latest copy
      autoFocus: false,
      direction: this.dir,
      data: { request, canManage: this.canManage() } as ActivationRequestDialogData,
    });

    ref.afterClosed().subscribe((result?: ActivationRequestDialogResult) => {
      this.dialogOpen = false;
      // Opened from a notification link → back to the plain tab URL.
      if (this.route.snapshot.paramMap.get('requestId')) {
        this.router.navigate(['/', this.currentLang, 'd3', 'demo-accounts', 'activation-requests'],
          { queryParamsHandling: 'preserve', replaceUrl: true });
      }
      if (result?.type === 'updated') {
        this.items = this.items.map(i => (i.id === result.request.id ? result.request : i));
      } else if (result?.type === 'missing') {
        this.load();
      }
    });
  }

  /** Opens the request named in the route: on this page if it is here, else scans the list. */
  private openPending(): void {
    const id = this.pendingOpenId;
    this.pendingOpenId = null;
    if (!id) return;

    const here = this.items.find(i => i.id === id);
    if (here) {
      this.open(here);
      return;
    }
    this.findRequest(id, 1).subscribe({
      next: found => {
        if (found) this.open(found);
        else this.toastr.error(this.translate.instant('d3.demoAccounts.errors.DEMO_ACTIVATION_REQUEST_NOT_FOUND'));
      },
      error: err => this.toastr.error(demoErrorMessage(readDemoError(err), this.translate)),
    });
  }

  private findRequest(id: string, pageNumber: number): Observable<ActivationRequest | null> {
    return this.service.listActivationRequests({ pageNumber, pageSize: FIND_PAGE_SIZE }).pipe(
      switchMap(res => {
        const found = (res.items ?? []).find(i => i.id === id);
        if (found) return of(found);
        return res.hasNextPage && pageNumber < FIND_MAX_PAGES ? this.findRequest(id, pageNumber + 1) : of(null);
      }),
    );
  }

  // ── Display helpers ────────────────────────────────────────

  statusLabel(status: string): string {
    return this.translate.instant(`d3.demoAccounts.activation.status.${status}`);
  }

  phone(value: string | null): string | null {
    return toLocalPhone(value);
  }

  lastActivity(r: ActivationRequest): string | null {
    return formatRiyadhDate(r.updatedAt ?? r.createdAt, this.currentLang, true);
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value ?? 0, this.currentLang);
  }

  private updateQuery(changes: Record<string, string | number | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
    });
  }
}
