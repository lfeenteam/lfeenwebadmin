import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Subscription, catchError, forkJoin, map, of } from 'rxjs';
import { PAGE_FLAGS } from 'src/app/config/page-flags';
import { format, isToday, isYesterday } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import { LoginService } from '../../services/login/login.service';
import { SettlementDetailDialogComponent, SettlementDetailDialogData, SettlementDialogResult } from './components/settlement-detail-dialog/settlement-detail-dialog.component';
import { RecalculationDialogComponent, RecalculationDialogData, RecalculationDialogResult } from './components/recalculation-dialog/recalculation-dialog.component';
import {
  ACTIONABLE_STATUSES, CURRENT_TAB_STATUSES, OPTIONAL_LIST_STATUSES, PREVIOUS_TAB_STATUSES, RECALCULABLE_STATUSES,
  RecalculationPreviewItem, RecalculationState,
  Settlement, SettlementDetail, SettlementSummary, recalculationStateOf,
} from './interfaces/settlement.model';
import { resolveSettlementError } from './interfaces/settlement-error.util';
import { SettlementsService } from './services/settlements.service';
import { MerchantDebtsComponent } from './merchant-debts/merchant-debts.component';
import { appLocale } from 'src/app/utils/locale-format.util';

/** Kept in the URL as `?tab=` (absent = current) so a link can open the debts tab directly. */
type SettlementTab = 'current' | 'previous' | 'debts';
type StatusClass = 'status-pending' | 'status-approved' | 'status-rejected' | '';

interface SettlementRow {
  id: string;
  payoutReference: string;
  /**
   * Listed by GET recalculation-preview: `needed` = recalculate before executing,
   * `onHold` = blocked (e.g. a refund under manual review). null = not listed / nothing to do.
   */
  recalcState: RecalculationState | null;
  /** '-' when the backend didn't return a merchant name. */
  accountInitials: string;
  partyName: string;
  amount: number | null;
  requestDate: Date | null;
  status: string;
  statusKey: string | null;
  statusClass: StatusClass;
  searchText: string;
  /** undefined = not fetched yet, null = fetched but the backend has no reason on file. */
  rejectionReason?: string | null;
}

const PAGE_SIZE = 8;
const EMPTY = '-';

// Backend status → the existing status pill styles + translation keys.
// Processing/PartiallyCompleted have no pill of their own in the design, so they
// reuse the closest existing one instead of introducing new colors.
const STATUS_META: Record<string, { key: string; cls: StatusClass }> = {
  Pending: { key: 'pending', cls: 'status-pending' },
  Processing: { key: 'processing', cls: 'status-pending' },
  Completed: { key: 'approved', cls: 'status-approved' },
  PartiallyCompleted: { key: 'partiallyCompleted', cls: 'status-approved' },
  Failed: { key: 'rejected', cls: 'status-rejected' },
  OnHold: { key: 'onHold', cls: 'status-pending' },
};

@Component({
  selector: 'app-settlements',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent, MerchantDebtsComponent],
  templateUrl: './settlements.component.html',
  styleUrl: './settlements.component.scss'
})
export class SettlementsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastrService);
  private service = inject(SettlementsService);
  private login = inject(LoginService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly canExecute = computed(() => this.hasPermission('settlements.execute'));

  readonly debtsEnabled = PAGE_FLAGS['settlement-debts'];
  /** Merchants with a settlement debt, shown next to the tab label; null until known. */
  debtsCount: number | null = null;
  private debtsCountRequest?: Subscription;
  /** False until the first ?tab= is read, so the initial load always runs. */
  private tabResolved = false;

  /** Payouts listed by recalculation-preview → what they need (keyed by id and by reference — the preview may carry either). */
  private recalcStates = new Map<string, RecalculationState>();
  private recalcCheckRequest?: Subscription;
  recalculatingId: string | null = null;

  currentLang = this.translate.currentLang || 'ar';
  activeTab: SettlementTab = 'current';
  searchQuery = '';
  newestFirst = true;
  currentPage = 1;

  loading = false;
  loadError = false;
  viewingId: string | null = null;

  /** Rows of the active tab (all statuses of that tab, all pages). */
  private allSettlements: SettlementRow[] = [];
  private filtered: SettlementRow[] = [];
  pagedSettlements: SettlementRow[] = [];

  private listRequest?: Subscription;
  private readonly rejectionReasons = new Map<string, string | null>();
  private readonly rejectionRequests = new Set<string>();

  readonly sortOptions: { value: boolean; labelKey: string }[] = [
    { value: true, labelKey: 'd3.settlements.filters.newest' },
    { value: false, labelKey: 'd3.settlements.filters.oldest' },
  ];

  readonly emptyValue = EMPTY;

  /** Stats cards data — comes with the list response; null until loaded. */
  summary: SettlementSummary | null = null;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });
  }

  ngOnInit(): void {
    // The debts tab loads its own list and reports the count, so fetch it here only otherwise.
    if (this.tabFrom(this.route.snapshot.queryParamMap) !== 'debts') this.refreshDebtsCount();
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => this.applyTab(this.tabFrom(params)));
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get selectedSortLabelKey(): string {
    return this.sortOptions.find(o => o.value === this.newestFirst)?.labelKey ?? 'd3.settlements.filters.newest';
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  fmtAmount(value: number): string {
    return value.toLocaleString(appLocale(this.currentLang), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  fmtHours(value: number): string {
    return value.toLocaleString(appLocale(this.currentLang), { maximumFractionDigits: 1 });
  }

  load(): void {
    // The debts tab has its own list (MerchantDebtsComponent).
    if (this.activeTab === 'debts') return;
    this.listRequest?.unsubscribe();
    this.loading = true;
    this.loadError = false;

    const statuses = this.activeTab === 'current' ? CURRENT_TAB_STATUSES : PREVIOUS_TAB_STATUSES;
    // Pending / OnHold (current tab) and Failed (previous tab) can all need recalculation, so the
    // preview is fetched once with either list. The badge is a hint — execute itself still
    // refuses — so a failing preview must never hide the list.
    const preview$ = this.service.recalculationPreview().pipe(catchError(() => of([] as RecalculationPreviewItem[])));

    this.listRequest = forkJoin([this.service.listAllByStatuses(statuses, OPTIONAL_LIST_STATUSES), preview$]).subscribe({
      next: ([{ items, summary }, preview]) => {
        const unchecked = this.readPreview(preview);
        this.summary = summary;
        this.allSettlements = items.map(s => this.toRow(s));
        this.loading = false;
        this.applyFilters();
        this.checkRecalculations(unchecked);
      },
      error: err => {
        this.summary = null;
        this.allSettlements = [];
        this.loading = false;
        this.loadError = true;
        this.applyFilters();
        // 403 is the only case where a retry can't help.
        if ((err as { status?: number })?.status === 403) {
          this.toastr.error(resolveSettlementError(err, this.translate));
        }
      },
    });
  }

  /** Tabs switch through the URL; applyTab() reacts to it, so back/forward and links work too. */
  setActiveTab(tab: SettlementTab): void {
    if (tab === this.activeTab) return;
    this.router.navigate([], {
      relativeTo: this.route,
      // A merchant filter belongs to the debts tab only.
      queryParams: { tab: tab === 'current' ? null : tab, accountId: null },
      queryParamsHandling: 'merge',
    });
  }

  onDebtsLoaded(count: number): void {
    this.debtsCount = count;
  }

  private tabFrom(params: ParamMap): SettlementTab {
    const tab = params.get('tab');
    if (tab === 'previous') return 'previous';
    if (tab === 'debts' && this.debtsEnabled) return 'debts';
    return 'current';
  }

  private applyTab(tab: SettlementTab): void {
    // Only ?accountId= changed (debts filter) — the tab itself is already showing.
    if (this.tabResolved && tab === this.activeTab) return;
    this.tabResolved = true;
    this.activeTab = tab;
    this.currentPage = 1;
    if (tab === 'debts') {
      this.listRequest?.unsubscribe();
      this.loading = false;
      return;
    }
    this.load();
  }

  /**
   * Records each previewed payout's state. An item that carries its own dry-run result
   * (hasChanges / blockers) is settled here; the ids of the rest are returned to be checked.
   */
  private readPreview(preview: RecalculationPreviewItem[]): string[] {
    this.recalcCheckRequest?.unsubscribe();
    this.recalcStates = new Map();
    const unchecked: string[] = [];
    for (const p of preview) {
      const id = p.payoutId ?? p.id ?? '';
      const known = p.hasChanges != null || p.blockers != null;
      this.setRecalcState(id, p.payoutReference, known ? recalculationStateOf(p) : 'needed');
      if (!known && id) unchecked.push(id);
    }
    return unchecked;
  }

  /**
   * A payout in recalculation-preview may have nothing to recalculate and only a blocker
   * (BUG-2205). Its dry run (saves nothing) tells which, so the badge doesn't send the admin
   * to a recalculation that can't be applied. Until it answers, the row keeps "needs recalculation".
   */
  private checkRecalculations(ids: string[]): void {
    if (!ids.length) return;
    this.recalcCheckRequest = forkJoin(ids.map(id =>
      this.service.getRecalculation(id).pipe(
        map(r => ({ id, ref: r.payoutReference, state: recalculationStateOf(r) })),
        catchError(() => of(null)),
      ),
    )).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(results => {
      for (const r of results) if (r) this.setRecalcState(r.id, r.ref, r.state);
      for (const row of this.allSettlements) row.recalcState = this.recalcStateOfRow(row.id, row.payoutReference, row.status);
    });
  }

  private setRecalcState(id: string | null | undefined, ref: string | null | undefined, state: RecalculationState): void {
    if (id) this.recalcStates.set(id, state);
    if (ref) this.recalcStates.set(ref, state);
  }

  private recalcStateOf(id: string, reference: string | null | undefined): RecalculationState | null {
    const state = this.recalcStates.get(id) ?? (reference ? this.recalcStates.get(reference) : undefined);
    return state && state !== 'none' ? state : null;
  }

  private recalcStateOfRow(id: string, reference: string | null | undefined, status: string): RecalculationState | null {
    return RECALCULABLE_STATUSES.includes(status) ? this.recalcStateOf(id, reference) : null;
  }

  /** Executing or recalculating a payout can settle or create a debt. */
  private refreshDebtsCount(): void {
    if (!this.debtsEnabled || this.activeTab === 'debts') return;
    this.debtsCountRequest?.unsubscribe();
    this.debtsCountRequest = this.service.debts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      // The count is a hint only; a failure just hides it.
      .subscribe({ next: debts => { this.debtsCount = debts.length; }, error: () => { this.debtsCount = null; } });
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.currentPage = 1;
    this.applyFilters();
  }

  onSortChange(value: boolean): void {
    this.newestFirst = value;
    this.currentPage = 1;
    this.applyFilters();
  }

  get totalCount(): number {
    return this.filtered.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalCount / PAGE_SIZE));
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePage();
  }

  // Pending requests read best as relative/compact ("Today 12:30 AM"); settled
  // history reads best as an exact, auditable date ("14 October 2023 | 09:45 AM").
  formatRequestDate(date: Date | null): string {
    if (!date) return EMPTY;
    const locale = this.currentLang === 'en' ? enUS : ar;
    const time = format(date, 'hh:mm a', { locale });

    if (this.activeTab === 'previous') {
      return `${format(date, 'd MMMM yyyy', { locale })} | ${time}`;
    }

    if (isToday(date)) {
      return `${this.translate.instant('d3.settlements.dateLabels.today')} ${time}`;
    }
    if (isYesterday(date)) {
      return `${this.translate.instant('d3.settlements.dateLabels.yesterday')} ${time}`;
    }
    return `${format(date, 'd MMMM', { locale })} ${time}`;
  }

  onView(row: SettlementRow): void {
    if (this.viewingId) return;
    this.viewingId = row.id;

    this.service.get(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => {
        this.viewingId = null;
        this.openDetailDialog(detail);
      },
      error: err => {
        this.viewingId = null;
        this.toastr.error(resolveSettlementError(err, this.translate));
      },
    });
  }

  private openDetailDialog(detail: SettlementDetail): void {
    const iban = detail.bank?.iban?.trim() || '';
    const meta = STATUS_META[detail.status];
    const isExecuted = detail.status === 'Completed' || detail.status === 'PartiallyCompleted';
    const isPartial = detail.status === 'PartiallyCompleted';
    // A full transfer is recorded with transferredAmount = null — the whole net amount went out.
    const transferred = detail.transferredAmount ?? detail.netAmount;
    const remaining = Math.max(0, Math.round((detail.netAmount - transferred) * 100) / 100);
    const originRef = detail.originatingPayoutId
      ? this.allSettlements.find(r => r.id === detail.originatingPayoutId)?.payoutReference || ''
      : '';
    const dialogRef = this.dialog.open(SettlementDetailDialogComponent, {
      width: '900px',
      maxWidth: '92vw',
      maxHeight: '92vh',
      panelClass: 'settlement-detail-panel',
      data: {
        id: detail.id,
        accountId: detail.accountId,
        netAmount: detail.netAmount,
        needsRecalculation: this.recalcStateOf(detail.id, detail.payoutReference) !== null,
        canExecute: this.canExecute() && ACTIONABLE_STATUSES.includes(detail.status),
        // A Failed / OnHold payout can't be executed here, but can (and may need to) be recalculated.
        canRecalculate: this.canExecute() && RECALCULABLE_STATUSES.includes(detail.status),
        accountName: detail.merchantName?.trim() || EMPTY,
        hostName: detail.hostName?.trim() || EMPTY,
        phone: detail.contactPhoneNumber?.trim() || EMPTY,
        amountFormatted: this.fmtAmount(detail.netAmount),
        currencyIconSrc: this.currencyIconSrc,
        isTextCurrency: this.currentLang === 'en',
        bankAccountHolder: detail.bank?.beneficiaryName?.trim() || EMPTY,
        bankName: detail.bank?.bankName?.trim() || EMPTY,
        bankAccountNumber: EMPTY,
        iban: iban || EMPTY,
        confirmedIban: detail.bank?.iban ?? '',
        hasIban: !!iban,
        swiftCode: detail.bank?.swiftCode?.trim() || EMPTY,
        bankVerified: detail.bankInfoStatus === 'Approved',
        payoutReference: detail.payoutReference?.trim() || EMPTY,
        requestDateLabel: this.fmtDetailDate(detail.createdAtUtc, true),
        periodLabel: `${this.fmtDetailDate(detail.periodStartUtc)} - ${this.fmtDetailDate(detail.periodEndUtc)}`,
        grossFormatted: this.fmtAmount(detail.grossAmount),
        feeFormatted: this.fmtAmount(detail.platformFee),
        entries: (detail.entries ?? []).map(e => ({
          bookingNumber: e.bookingNumber?.trim() || EMPTY,
          gross: this.fmtAmount(e.grossAmount),
          fee: this.fmtAmount(e.feeAmount),
          net: this.fmtAmount(e.netAmount),
          isRefundAfterSettlement: e.isRefundAfterSettlement === true,
        })),
        statusKey: meta ? `d3.settlements.status.${meta.key}` : null,
        statusLabel: detail.status || EMPTY,
        statusClass: meta?.cls ?? '',
        isExecuted,
        isPartial,
        transferredFormatted: this.fmtAmount(transferred),
        remainingFormatted: this.fmtAmount(remaining),
        partialReason: detail.partialSettlementReason?.trim() || EMPTY,
        bankTransferReference: detail.bankTransferReference?.trim() || EMPTY,
        processedAtLabel: this.fmtDetailDate(detail.completedAtUtc ?? detail.processedAtUtc ?? detail.lastActionAtUtc, true),
        processedBy: detail.lastActionByAdminName?.trim() || EMPTY,
        receiptUrl: detail.receiptUrl?.trim() || null,
        rejectionReason: detail.status === 'Failed' ? (detail.notes?.trim() || null) : null,
        isRemainder: !!detail.originatingPayoutId,
        originatingReference: originRef,
      } as SettlementDetailDialogData
    });

    // Any result means the payout changed on the server (or turned out stale) —
    // reload so statuses and the leftover Pending payout of a partial transfer show up.
    dialogRef.afterClosed().subscribe((result?: SettlementDialogResult) => {
      if (!result) return;
      this.load();
      this.refreshDebtsCount();
      // Recalculated from inside the dialog: reopen it on the new totals so execute can go ahead.
      if (result.decision === 'recalculated') this.reopen(detail.id);
    });
  }

  private reopen(id: string): void {
    this.viewingId = id;
    this.service.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => {
        this.viewingId = null;
        this.recalcStates.delete(detail.id);
        this.recalcStates.delete(detail.payoutReference);
        this.openDetailDialog(detail);
      },
      error: err => {
        this.viewingId = null;
        this.toastr.error(resolveSettlementError(err, this.translate));
      },
    });
  }

  onRecalculate(row: SettlementRow): void {
    if (this.recalculatingId || !this.canExecute()) return;
    this.recalculatingId = row.id;
    this.dialog.open<RecalculationDialogComponent, RecalculationDialogData, RecalculationDialogResult>(RecalculationDialogComponent, {
      width: '560px',
      maxWidth: '92vw',
      maxHeight: '92vh',
      data: {
        id: row.id,
        payoutReference: row.payoutReference || EMPTY,
        accountName: row.partyName,
        currencyIconSrc: this.currencyIconSrc,
        isTextCurrency: this.currentLang === 'en',
      },
    }).afterClosed().subscribe(result => {
      this.recalculatingId = null;
      if (!result?.applied) return;
      this.load();
      this.refreshDebtsCount();
    });
  }

  private fmtDetailDate(value: string | null, withTime = false): string {
    const date = parseApiUtc(value);
    if (!date) return EMPTY;
    const locale = this.currentLang === 'en' ? enUS : ar;
    const day = format(date, 'd MMMM yyyy', { locale });
    return withTime ? `${day} | ${format(date, 'hh:mm a', { locale })}` : day;
  }

  private toRow(s: Settlement): SettlementRow {
    const name = s.merchantName?.trim() || '';
    const meta = STATUS_META[s.status];
    const cached = this.rejectionReasons.get(s.id);
    return {
      id: s.id,
      payoutReference: s.payoutReference?.trim() || '',
      recalcState: this.recalcStateOfRow(s.id, s.payoutReference, s.status),
      accountInitials: name ? this.initialsOf(name) : EMPTY,
      partyName: name || EMPTY,
      amount: typeof s.netAmount === 'number' ? s.netAmount : null,
      requestDate: parseApiUtc(s.createdAtUtc),
      status: s.status,
      statusKey: meta ? `d3.settlements.status.${meta.key}` : null,
      statusClass: meta?.cls ?? '',
      searchText: `${name} ${s.payoutReference ?? ''} ${s.bankTransferReference ?? ''}`.toLowerCase(),
      rejectionReason: cached,
    };
  }

  private initialsOf(name: string): string {
    const words = name.split(/\s+/).filter(Boolean);
    const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
    return letters.toUpperCase();
  }

  private applyFilters(): void {
    const q = this.searchQuery.trim().toLowerCase();
    const list = q ? this.allSettlements.filter(r => r.searchText.includes(q)) : [...this.allSettlements];
    const time = (r: SettlementRow) => r.requestDate?.getTime() ?? 0;
    list.sort((a, b) => (this.newestFirst ? time(b) - time(a) : time(a) - time(b)));
    this.filtered = list;
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    this.updatePage();
  }

  private updatePage(): void {
    const start = (this.currentPage - 1) * PAGE_SIZE;
    this.pagedSettlements = this.filtered.slice(start, start + PAGE_SIZE);
    this.loadRejectionReasons();
  }

  // The list endpoint always returns `notes: null`, so the rejection reason shown
  // under a Failed status is fetched from the detail endpoint — only for the rows
  // on the visible page, and only once per row.
  private loadRejectionReasons(): void {
    for (const row of this.pagedSettlements) {
      if (row.status !== 'Failed' || row.rejectionReason !== undefined || this.rejectionRequests.has(row.id)) continue;
      this.rejectionRequests.add(row.id);
      this.service.get(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: detail => {
          const reason = detail.notes?.trim() || null;
          this.rejectionReasons.set(row.id, reason);
          this.rejectionRequests.delete(row.id);
          row.rejectionReason = reason;
        },
        error: () => { this.rejectionRequests.delete(row.id); },
      });
    }
  }

  private hasPermission(permission: string): boolean {
    return this.login.permissions().some(p => p.toLowerCase() === permission);
  }
}
