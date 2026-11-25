import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatDialog } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, map } from 'rxjs/operators';
import { MaterialModule } from 'src/app/material.module';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatLocalizedNumber, getVisiblePages } from 'src/app/utils/pagination.util';
import { LoginService } from '../../../../services/login/login.service';
import { DemoSignupLinksService } from '../../../../services/demo-signup-links.service';
import { DEMO_CHANNEL_ICONS, DEMO_KIND_ICONS, DEMO_LIMITS, DEMO_PERMISSIONS, toLocalPhone } from '../../../../interfaces/demo-account.model';
import {
  DEMO_SIGNUP_STATES,
  DemoSignupBatch,
  DemoSignupCancelResult,
  DemoSignupLink,
  DemoSignupLinkState
} from '../../../../interfaces/demo-signup-link.model';
import { deliveryErrorText, formatRiyadhDate, readDemoError } from '../../demo-accounts.util';
import { DEMO_DEFAULT_PAGE_SIZE, DEMO_PAGE_SIZES } from '../../demo-list-state';
import { DemoTabsComponent } from '../../components/demo-tabs/demo-tabs.component';
import { CancelLinksDialogComponent, CancelLinksDialogData } from '../components/cancel-links-dialog.component';
import { shortLink, signupErrorMessage, signupLinkUrl, signupStateClass, signupStateLabel } from '../demo-signup-links.util';

const EMPTY = '—';

// /demo-accounts/signup-links — "Track links": one row per link with who signed up, how the
// data was sent and whether it arrived; cancel one link, the checked ones or a whole batch.
// The filters live in the URL (?state=&batchId=&search=&page=&size=).
@Component({
  selector: 'app-signup-links-list',
  standalone: true,
  imports: [CommonModule, RouterLink, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent, DemoTabsComponent],
  templateUrl: './signup-links-list.component.html',
  styleUrls: ['../../demo-accounts.component.scss', './signup-links-list.component.scss']
})
export class SignupLinksListComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly service = inject(DemoSignupLinksService);
  private readonly login = inject(LoginService);
  private readonly dialog = inject(MatDialog);
  private readonly toastr = inject(ToastrService);
  private readonly clipboard = inject(Clipboard);

  readonly canManage = computed(() =>
    this.login.permissions().some(p => p.toLowerCase() === DEMO_PERMISSIONS.manage)
  );

  readonly states = DEMO_SIGNUP_STATES;
  readonly all = 'all';
  readonly channelIcons = DEMO_CHANNEL_ICONS;
  readonly kindIcons = DEMO_KIND_ICONS;
  readonly searchMax = DEMO_LIMITS.search;
  readonly emptyValue = EMPTY;
  readonly pageSizes = DEMO_PAGE_SIZES;
  readonly shortLink = shortLink;
  readonly stateClass = signupStateClass;

  currentLang = this.translate.currentLang || 'ar';

  // Mirrors the URL query — the URL is the source of truth.
  searchText = '';
  state: DemoSignupLinkState | null = null;
  batchId: string | null = null;
  page = 1;
  pageSize: number = DEMO_DEFAULT_PAGE_SIZE;

  items: DemoSignupLink[] = [];
  totalCount = 0;
  loading = false;
  loadError: string | null = null;
  /** DEMO_SIGNUP_DISABLED: the feature is off on the server. */
  featureDisabled = false;

  batches: DemoSignupBatch[] = [];
  /** Checked rows (ids), kept across pages until a cancel or a filter change. */
  readonly selected = new Set<string>();
  copiedId: string | null = null;

  private readonly searchInput$ = new Subject<string>();
  private listRequest?: Subscription;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });
  }

  ngOnInit(): void {
    this.loadBatches();

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const state = params.get('state') as DemoSignupLinkState | null;
      const page = Number(params.get('page'));
      const size = Number(params.get('size'));
      const filtersChanged = state !== this.state || params.get('batchId') !== this.batchId
        || (params.get('search') ?? '') !== this.searchText;
      this.searchText = (params.get('search') ?? '').slice(0, DEMO_LIMITS.search);
      // Any other value would be a 400 DEMO_SIGNUP_STATE_INVALID — ignore it.
      this.state = state && DEMO_SIGNUP_STATES.includes(state) ? state : null;
      this.batchId = params.get('batchId') || null;
      this.page = Number.isInteger(page) && page > 0 ? page : 1;
      this.pageSize = (DEMO_PAGE_SIZES as readonly number[]).includes(size) ? size : DEMO_DEFAULT_PAGE_SIZE;
      if (filtersChanged) this.selected.clear();
      this.load();
    });

    this.searchInput$
      .pipe(map(v => v.trim()), debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(search => {
        if (search !== this.searchText) this.updateQuery({ search: search || null, page: null });
      });
  }

  get dir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get hasFilters(): boolean {
    return !!this.searchText || !!this.state || !!this.batchId;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / this.pageSize));
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.page, this.totalPages);
  }

  /** The batch picked in the filter (its counters come from GET batches). */
  get batch(): DemoSignupBatch | null {
    return this.batchId ? this.batches.find(b => b.id === this.batchId) ?? null : null;
  }

  // ── Loading ───────────────────────────────────────────────

  load(): void {
    this.listRequest?.unsubscribe();
    this.loading = true;
    this.loadError = null;

    this.listRequest = this.service.list({
      batchId: this.batchId,
      state: this.state,
      search: this.searchText || null,
      pageNumber: this.page,
      pageSize: this.pageSize,
    }).subscribe({
      next: res => {
        this.featureDisabled = false;
        this.items = res?.items ?? [];
        this.totalCount = res?.totalCount ?? 0;
        this.loading = false;
        if (!this.items.length && this.page > this.totalPages) {
          this.updateQuery({ page: this.totalPages > 1 ? this.totalPages : null });
        }
      },
      error: err => {
        const e = readDemoError(err);
        this.items = [];
        this.totalCount = 0;
        this.loading = false;
        this.featureDisabled = e.code === 'DEMO_SIGNUP_DISABLED';
        if (!this.featureDisabled) this.loadError = signupErrorMessage(e, this.translate);
      },
    });
  }

  /** The batch filter list; newest first, up to 100 (the page size limit). */
  loadBatches(): void {
    this.service.batches(1, 100).subscribe({
      next: res => (this.batches = res?.items ?? []),
      error: () => (this.batches = []),
    });
  }

  // ── Filters / paging ──────────────────────────────────────

  onSearchInput(value: string): void {
    this.searchInput$.next(value);
  }

  onStateChange(value: string): void {
    this.updateQuery({ state: value === this.all ? null : value, page: null });
  }

  onBatchChange(value: string): void {
    this.updateQuery({ batchId: value === this.all ? null : value, page: null });
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) return;
    this.updateQuery({ page: page === 1 ? null : page });
  }

  onPageSizeChange(size: number): void {
    this.updateQuery({ size: size === DEMO_DEFAULT_PAGE_SIZE ? null : size, page: null });
  }

  clearFilters(): void {
    this.updateQuery({ search: null, state: null, batchId: null, page: null });
  }

  openCreate(): void {
    if (!this.canManage() || this.featureDisabled) return;
    this.router.navigate(['/', this.currentLang, 'd3', 'demo-accounts', 'signup-links', 'new']);
  }

  // ── Rows ──────────────────────────────────────────────────

  /** A used row opens the demo account (resend, new PIN and extend live there). */
  canOpen(link: DemoSignupLink): boolean {
    return !!link.demoAccountId;
  }

  open(link: DemoSignupLink): void {
    if (!link.demoAccountId) return;
    this.router.navigate(['/', this.currentLang, 'd3', 'demo-accounts', link.demoAccountId]);
  }

  copy(link: DemoSignupLink, event?: Event): void {
    event?.stopPropagation();
    const value = signupLinkUrl(link) ?? link.code;
    if (!this.clipboard.copy(value)) {
      this.toastr.error(this.translate.instant('d3.demoAccounts.copyFailed'));
      return;
    }
    this.copiedId = link.id;
    setTimeout(() => { if (this.copiedId === link.id) this.copiedId = null; }, 1500);
  }

  // ── Selection ─────────────────────────────────────────────

  get cancellableOnPage(): DemoSignupLink[] {
    return this.items.filter(l => l.canCancel);
  }

  get allOnPageSelected(): boolean {
    const rows = this.cancellableOnPage;
    return rows.length > 0 && rows.every(l => this.selected.has(l.id));
  }

  get someOnPageSelected(): boolean {
    return this.cancellableOnPage.some(l => this.selected.has(l.id)) && !this.allOnPageSelected;
  }

  toggle(link: DemoSignupLink, checked: boolean): void {
    if (!link.canCancel) return;
    if (checked) this.selected.add(link.id);
    else this.selected.delete(link.id);
  }

  toggleAll(checked: boolean): void {
    for (const l of this.cancellableOnPage) {
      if (checked) this.selected.add(l.id);
      else this.selected.delete(l.id);
    }
  }

  // ── Cancelling ────────────────────────────────────────────

  cancelOne(link: DemoSignupLink, event?: Event): void {
    event?.stopPropagation();
    if (!link.canCancel) return;
    this.confirmCancel({ mode: 'links', linkIds: [link.id] });
  }

  cancelSelected(): void {
    if (!this.selected.size) return;
    this.confirmCancel({ mode: 'links', linkIds: [...this.selected] });
  }

  cancelBatch(): void {
    if (!this.batchId) return;
    this.confirmCancel({ mode: 'batch', batchId: this.batchId, openLinks: this.batch?.openLinks ?? null });
  }

  private confirmCancel(data: CancelLinksDialogData): void {
    if (!this.canManage()) return;
    this.dialog.open<CancelLinksDialogComponent, CancelLinksDialogData, DemoSignupCancelResult>(CancelLinksDialogComponent, {
      width: '460px',
      maxWidth: '94vw',
      direction: this.dir,
      data,
    }).afterClosed().subscribe(result => {
      if (!result) return;
      this.toastr.success(this.translate.instant('d3.demoAccounts.signupLinks.cancel.done', {
        cancelled: formatLocalizedNumber(result.cancelled ?? 0, this.currentLang),
        skipped: formatLocalizedNumber(result.skipped ?? 0, this.currentLang),
      }));
      this.selected.clear();
      this.load();
      this.loadBatches();
    });
  }

  // ── Display helpers ───────────────────────────────────────

  stateLabel(link: DemoSignupLink): string {
    return signupStateLabel(link, this.translate);
  }

  stateFilterLabel(state: DemoSignupLinkState): string {
    return this.translate.instant(`d3.demoAccounts.signupLinks.states.${state}`);
  }

  batchLabel(b: DemoSignupBatch): string {
    const kind = this.translate.instant(`d3.demoAccounts.kinds.${b.kind}`);
    const date = formatRiyadhDate(b.createdAt, this.currentLang) ?? '';
    return `${date} · ${kind} · ${this.fmt(b.totalLinks ?? 0)} ${this.translate.instant('d3.demoAccounts.signupLinks.filters.linksUnit')}`;
  }

  url(link: DemoSignupLink): string | null {
    return signupLinkUrl(link);
  }

  channelLabel(channel: string | null): string {
    if (!channel) return EMPTY;
    const key = `d3.demoAccounts.channels.${channel}`;
    const label = this.translate.instant(key);
    return label === key ? channel : label;
  }

  /** A phone is shown as 05…; an email as is. */
  contact(link: DemoSignupLink): string {
    if (!link.contact) return EMPTY;
    return link.channel === 'Sms' ? (toLocalPhone(link.contact) ?? link.contact) : link.contact;
  }

  deliveryError(link: DemoSignupLink): string {
    return deliveryErrorText(link.deliveryError, this.translate)
      ?? this.translate.instant('d3.demoAccounts.signupLinks.table.notDelivered');
  }

  phone(value: string | null): string {
    return toLocalPhone(value) ?? value ?? EMPTY;
  }

  date(value: string | null, withTime = true): string {
    return formatRiyadhDate(value, this.currentLang, withTime) ?? EMPTY;
  }

  fmt(value: number | null | undefined): string {
    return formatLocalizedNumber(value ?? 0, this.currentLang);
  }

  private updateQuery(changes: Record<string, string | number | null>): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: changes, queryParamsHandling: 'merge' });
  }
}
