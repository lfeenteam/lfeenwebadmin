import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { format, isToday, isYesterday } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import { LoginService } from '../../services/login/login.service';
import { SettlementDetailDialogComponent, SettlementDetailDialogData, SettlementDialogResult } from './components/settlement-detail-dialog/settlement-detail-dialog.component';
import { ACTIONABLE_STATUSES, CURRENT_TAB_STATUSES, PREVIOUS_TAB_STATUSES, Settlement, SettlementDetail } from './interfaces/settlement.model';
import { resolveSettlementError } from './interfaces/settlement-error.util';
import { SettlementsService } from './services/settlements.service';

type SettlementTab = 'current' | 'previous';
type StatusClass = 'status-pending' | 'status-approved' | 'status-rejected' | '';

interface SettlementRow {
  id: string;
  /** '-' when the backend didn't return a merchant name. */
  accountInitials: string;
  partyName: string;
  ownerName: string;
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
};

@Component({
  selector: 'app-settlements',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent],
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

  private readonly canExecute = computed(() => this.hasPermission('settlements.execute'));

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

  // The stats cards have no backend source yet — they render "-" (see template).
  readonly emptyValue = EMPTY;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });
  }

  ngOnInit(): void {
    this.load();
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
    return value.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  load(): void {
    this.listRequest?.unsubscribe();
    this.loading = true;
    this.loadError = false;

    const statuses = this.activeTab === 'current' ? CURRENT_TAB_STATUSES : PREVIOUS_TAB_STATUSES;
    this.listRequest = this.service.listAllByStatuses(statuses).subscribe({
      next: items => {
        this.allSettlements = items.map(s => this.toRow(s));
        this.loading = false;
        this.applyFilters();
      },
      error: err => {
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

  setActiveTab(tab: SettlementTab): void {
    if (tab === this.activeTab) return;
    this.activeTab = tab;
    this.currentPage = 1;
    this.load();
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
    const dialogRef = this.dialog.open(SettlementDetailDialogComponent, {
      width: '480px',
      maxWidth: '92vw',
      panelClass: 'settlement-detail-panel',
      data: {
        id: detail.id,
        netAmount: detail.netAmount,
        canExecute: this.canExecute() && ACTIONABLE_STATUSES.includes(detail.status),
        accountName: detail.merchantName?.trim() || EMPTY,
        hostName: EMPTY,
        phone: detail.contactPhoneNumber?.trim() || EMPTY,
        amountFormatted: this.fmtAmount(detail.netAmount),
        currencyIconSrc: this.currencyIconSrc,
        isTextCurrency: this.currentLang === 'en',
        bankAccountHolder: detail.bank?.beneficiaryName?.trim() || EMPTY,
        bankName: detail.bank?.bankName?.trim() || EMPTY,
        bankAccountNumber: EMPTY,
        iban: iban || EMPTY,
        hasIban: !!iban,
        bankVerified: detail.bankInfoStatus === 'Approved',
      } as SettlementDetailDialogData
    });

    // Any result means the payout changed on the server (or turned out stale) —
    // reload so statuses and the leftover Pending payout of a partial transfer show up.
    dialogRef.afterClosed().subscribe((result?: SettlementDialogResult) => {
      if (result) this.load();
    });
  }

  private toRow(s: Settlement): SettlementRow {
    const name = s.merchantName?.trim() || '';
    const meta = STATUS_META[s.status];
    const cached = this.rejectionReasons.get(s.id);
    return {
      id: s.id,
      accountInitials: name ? this.initialsOf(name) : EMPTY,
      partyName: name || EMPTY,
      ownerName: EMPTY,
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
