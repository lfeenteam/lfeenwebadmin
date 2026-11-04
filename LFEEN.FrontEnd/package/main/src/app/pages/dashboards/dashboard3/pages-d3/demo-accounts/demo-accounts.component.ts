import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, map } from 'rxjs/operators';
import { MaterialModule } from 'src/app/material.module';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatLocalizedNumber, getVisiblePages } from 'src/app/utils/pagination.util';
import { LoginService } from '../../services/login/login.service';
import { DemoAccountsService } from '../../services/demo-accounts.service';
import {
  DEMO_CHANNEL_ICONS,
  DEMO_LIMITS,
  DEMO_PERMISSIONS,
  DEMO_STATUSES,
  DemoAccount,
  DemoAccountStatus,
  DemoChannel,
  toLocalPhone
} from '../../interfaces/demo-account.model';
import { ToastrService } from 'ngx-toastr';
import { DEMO_ACTION_BUTTONS, demoActionToast, demoErrorMessage, formatRiyadhDate, readDemoError } from './demo-accounts.util';
import { CreateDemoDialogComponent, CreateDemoDialogResult } from './components/create-demo-dialog/create-demo-dialog.component';
import {
  DemoAction,
  DemoActionDialogComponent,
  DemoActionDialogData,
  DemoActionDialogResult
} from './components/demo-action-dialog/demo-action-dialog.component';
import { CredentialsDialogComponent, CredentialsDialogData } from './components/credentials-dialog/credentials-dialog.component';

const PAGE_SIZE = 20;
const EMPTY = '—';

@Component({
  selector: 'app-demo-accounts',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './demo-accounts.component.html',
  styleUrl: './demo-accounts.component.scss'
})
export class DemoAccountsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly service = inject(DemoAccountsService);
  private readonly login = inject(LoginService);
  private readonly toastr = inject(ToastrService);

  readonly canManage = computed(() =>
    this.login.permissions().some(p => p.toLowerCase() === DEMO_PERMISSIONS.manage)
  );

  readonly statuses = DEMO_STATUSES;
  // mat-select shows nothing for a null value, so "All" gets its own option value.
  readonly allStatuses = 'all';
  readonly channelIcons = DEMO_CHANNEL_ICONS;
  readonly actions = DEMO_ACTION_BUTTONS;
  readonly searchMax = DEMO_LIMITS.search;
  readonly emptyValue = EMPTY;

  currentLang = this.translate.currentLang || 'ar';

  // Mirrors the URL query (?search=&status=&page=) — the URL is the source of truth.
  searchText = '';
  status: DemoAccountStatus | null = null;
  page = 1;
  readonly pageSize = PAGE_SIZE;

  items: DemoAccount[] = [];
  totalCount = 0;
  totalPages = 1;

  loading = false;
  loadError: string | null = null;
  /** The feature is off on the backend (DEMO_DISABLED): banner, empty table, create disabled. */
  demoDisabled = false;
  /** A row action dialog is open — the other row actions are off. */
  busy = false;

  private readonly searchInput$ = new Subject<string>();
  private listRequest?: Subscription;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const status = params.get('status') as DemoAccountStatus | null;
      const page = Number(params.get('page'));
      this.searchText = (params.get('search') ?? '').slice(0, DEMO_LIMITS.search);
      this.status = status && DEMO_STATUSES.includes(status) ? status : null;
      this.page = Number.isInteger(page) && page > 0 ? page : 1;
      this.load();
    });

    this.searchInput$
      .pipe(
        map(v => v.trim()),
        debounceTime(400),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(search => {
        if (search !== this.searchText) this.updateQuery({ search: search || null, page: null });
      });
  }

  get dir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get hasFilters(): boolean {
    return !!this.searchText || !!this.status;
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.page, this.totalPages);
  }

  load(): void {
    this.listRequest?.unsubscribe();
    this.loading = true;
    this.loadError = null;

    this.listRequest = this.service.list({
      search: this.searchText || null,
      status: this.status,
      pageNumber: this.page,
      pageSize: this.pageSize,
    }).subscribe({
      next: res => {
        this.demoDisabled = false;
        this.items = res.items ?? [];
        this.totalCount = res.totalCount ?? 0;
        this.totalPages = Math.max(1, res.totalPages ?? 1);
        this.loading = false;
        // A page past the end (stale bookmark, rows removed) → go to the last real page.
        if (!this.items.length && this.page > this.totalPages) {
          this.updateQuery({ page: this.totalPages > 1 ? this.totalPages : null });
        }
      },
      error: err => {
        const e = readDemoError(err);
        this.items = [];
        this.totalCount = 0;
        this.totalPages = 1;
        this.loading = false;
        this.demoDisabled = e.code === 'DEMO_DISABLED';
        if (!this.demoDisabled) this.loadError = demoErrorMessage(e, this.translate);
      },
    });
  }

  onSearchInput(value: string): void {
    this.searchInput$.next(value);
  }

  onStatusChange(value: string): void {
    this.updateQuery({ status: value === this.allStatuses ? null : value, page: null });
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) return;
    this.updateQuery({ page: page === 1 ? null : page });
  }

  clearFilters(): void {
    this.updateQuery({ search: null, status: null, page: null });
  }

  open(item: DemoAccount): void {
    this.router.navigate(['/', this.currentLang, 'd3', 'demo-accounts', item.id]);
  }

  // Row ⋮ menu: the same dialogs as the details header. The list is reloaded afterwards
  // so status/days left (and the status filter) stay right.
  openAction(item: DemoAccount, action: DemoAction): void {
    if (!this.canManage() || this.busy || item.status === 'Disabled') return;
    this.busy = true;

    const ref = this.dialog.open(DemoActionDialogComponent, {
      width: action === 'disable' ? '480px' : '520px',
      maxWidth: '94vw',
      disableClose: true,
      direction: this.dir,
      data: { action, account: item } as DemoActionDialogData,
    });

    ref.afterClosed().subscribe((result?: DemoActionDialogResult) => {
      this.busy = false;
      if (!result) return;

      if (result.type === 'error') {
        // Not found / already disabled by someone else — say so and show the list as it is now.
        this.toastr.error(demoErrorMessage(result.error, this.translate));
        this.load();
        return;
      }

      if (result.type === 'credentials') {
        const account = result.credentials.account;
        const recipient = account.channel === 'Email' ? account.email : toLocalPhone(account.contactPhone);
        this.load();
        this.dialog.open(CredentialsDialogComponent, {
          width: '520px',
          maxWidth: '94vw',
          disableClose: true,
          direction: this.dir,
          data: { credentials: result.credentials, mode: 'resetPin', recipient } as CredentialsDialogData,
        });
        return;
      }

      const toast = demoActionToast(action, result.account, this.translate, this.currentLang);
      if (toast) toast.ok ? this.toastr.success(toast.message) : this.toastr.error(toast.message);
      this.load();
    });
  }

  openCreate(): void {
    if (!this.canManage() || this.demoDisabled) return;

    const ref = this.dialog.open(CreateDemoDialogComponent, {
      width: '640px',
      maxWidth: '94vw',
      disableClose: true,
      autoFocus: 'first-tabbable',
      direction: this.dir,
    });

    ref.afterClosed().subscribe((result?: CreateDemoDialogResult) => {
      if (!result) return;

      if (result.type === 'duplicate') {
        // The account exists but the PIN of that response is lost (§6.2): show it by name.
        const search = result.fullName.trim().slice(0, DEMO_LIMITS.search);
        if (search === this.searchText && !this.status && this.page === 1) {
          this.load();
        } else {
          this.updateQuery({ search: search || null, status: null, page: null });
        }
        return;
      }

      if (result.type === 'disabled') {
        this.demoDisabled = true;
        this.items = [];
        return;
      }

      this.load();
      const accountId = result.credentials.account.id;
      const credentialsRef = this.dialog.open(CredentialsDialogComponent, {
        width: '520px',
        maxWidth: '94vw',
        disableClose: true,
        direction: this.dir,
        data: {
          credentials: result.credentials,
          mode: 'create',
          recipient: result.recipient,
        } as CredentialsDialogData,
      });
      credentialsRef.afterClosed().subscribe(() => {
        this.router.navigate(['/', this.currentLang, 'd3', 'demo-accounts', accountId]);
      });
    });
  }

  // ── Display helpers ────────────────────────────────────────

  statusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  statusLabel(status: string): string {
    const key = `d3.demoAccounts.status.${status}`;
    const label = this.translate.instant(key);
    return label === key ? status : label;
  }

  channelLabel(channel: DemoChannel): string {
    const key = `d3.demoAccounts.channels.${channel}`;
    const label = this.translate.instant(key);
    return label === key ? channel : label;
  }

  phone(value: string | null): string {
    return toLocalPhone(value) ?? EMPTY;
  }

  date(value: string | null): string {
    return formatRiyadhDate(value, this.currentLang) ?? EMPTY;
  }

  daysLeft(item: DemoAccount): string | null {
    if (item.status === 'Expired' || item.status === 'Disabled') return null;
    return formatLocalizedNumber(Math.max(0, item.daysLeft ?? 0), this.currentLang);
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  private updateQuery(changes: Record<string, string | number | null>): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: changes,
      queryParamsHandling: 'merge',
    });
  }
}
