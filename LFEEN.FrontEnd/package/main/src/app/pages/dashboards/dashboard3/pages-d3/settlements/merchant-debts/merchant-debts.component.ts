import { Component, DestroyRef, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import { appLocale } from 'src/app/utils/locale-format.util';
import { MerchantDebt, MerchantDebtLine } from '../interfaces/settlement.model';
import { resolveSettlementError } from '../interfaces/settlement-error.util';
import { adjustmentKindKey, paymentMethodKey } from '../interfaces/settlement-labels.util';
import { SettlementsService } from '../services/settlements.service';

interface DebtLineRow {
  /** Label key of the line's kind; null when the line carries no kind. */
  kindKey: string | null;
  description: string;
  bookingNumber: string;
  payoutReference: string;
  /** Label key for a known method; otherwise `method` holds the server value. */
  methodKey: string | null;
  method: string;
  gross: number | null;
  fee: number | null;
  net: number | null;
  date: string;
}

interface DebtRow {
  accountId: string;
  merchant: string;
  outstandingClawbackNet: number;
  unsettledDuesNet: number;
  balance: number;
  since: string;
  isClaim: boolean;
  lines: DebtLineRow[];
  /** The core doesn't send booking number / payout reference yet — a column with no value on any line is hidden. */
  showBooking: boolean;
  showPayoutRef: boolean;
  /** grid-template-columns for this merchant's lines, matching the visible columns. */
  lineColumns: string;
  searchText: string;
}

const EMPTY = '-';

const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const text = (value: unknown): string => (value == null ? '' : String(value).trim());

/**
 * Merchant settlement debts (BUG-1482) — read-only mirror of GET /api/settlements/debts.
 * Shown as the "Merchant debts" tab of Settlements; `?accountId=` narrows it to one merchant.
 */
@Component({
  selector: 'app-merchant-debts',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './merchant-debts.component.html',
  styleUrl: './merchant-debts.component.scss'
})
export class MerchantDebtsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private service = inject(SettlementsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  /** Number of merchants listed, for the tab's count; emitted after each successful load. */
  @Output() readonly loaded = new EventEmitter<number>();

  readonly emptyValue = EMPTY;

  currentLang = this.translate.currentLang || 'ar';
  loading = false;
  loadError: string | null = null;
  searchQuery = '';
  /** Set when opened from a refused execute (MERCHANT_SETTLEMENT_DEBT_OUTSTANDING). */
  accountFilter: string | null = null;

  private rows: DebtRow[] = [];
  private raw: MerchantDebt[] = [];
  visibleRows: DebtRow[] = [];
  readonly expanded = new Set<string>();

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLang = event.lang;
        // Dates and kind labels are formatted per language.
        this.rows = this.raw.map(d => this.toRow(d));
        this.applyFilters();
      });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.accountFilter = params.get('accountId')?.trim() || null;
      if (this.accountFilter) this.expanded.add(this.accountFilter);
      this.applyFilters();
    });
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

  get filteredMerchantName(): string {
    return this.rows.find(r => r.accountId === this.accountFilter)?.merchant ?? this.accountFilter ?? '';
  }

  load(): void {
    this.loading = true;
    this.loadError = null;
    this.service.debts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: debts => {
        this.raw = debts;
        this.rows = debts.map(d => this.toRow(d));
        this.loading = false;
        this.applyFilters();
        this.loaded.emit(debts.length);
      },
      error: err => {
        this.raw = [];
        this.rows = [];
        this.loading = false;
        this.loadError = resolveSettlementError(err, this.translate);
        this.applyFilters();
      },
    });
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.applyFilters();
  }

  clearAccountFilter(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { accountId: null }, queryParamsHandling: 'merge' });
  }

  toggle(row: DebtRow): void {
    if (this.expanded.has(row.accountId)) this.expanded.delete(row.accountId);
    else this.expanded.add(row.accountId);
  }

  fmtAmount(value: number | null | undefined): string {
    if (typeof value !== 'number') return EMPTY;
    return value.toLocaleString(appLocale(this.currentLang), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private applyFilters(): void {
    const q = this.searchQuery.trim().toLowerCase();
    this.visibleRows = this.rows.filter(r =>
      (!this.accountFilter || r.accountId === this.accountFilter) && (!q || r.searchText.includes(q)));
  }

  private toRow(d: MerchantDebt): DebtRow {
    // The core doesn't send the merchant's name yet — the account id stands in until it does.
    const merchant = text(d.merchantName) || text(d.tradeName) || d.accountId;
    const lines = (d.lines ?? []).map(l => this.toLine(l));
    // The booking cell also carries the line's kind and description, so it stays when either is present.
    const showBooking = lines.some(l => l.bookingNumber !== EMPTY || !!l.kindKey || !!l.description);
    const showPayoutRef = lines.some(l => l.payoutReference !== EMPTY);
    const lineColumns = [showBooking && '1.4fr', showPayoutRef && '1.3fr', '1fr', '0.9fr', '0.9fr', '0.9fr', '1fr']
      .filter(Boolean)
      .join(' ');
    return {
      accountId: d.accountId,
      merchant,
      outstandingClawbackNet: d.outstandingClawbackNet ?? 0,
      unsettledDuesNet: d.unsettledDuesNet ?? 0,
      balance: d.balance ?? 0,
      since: this.fmtDate(d.sinceUtc),
      isClaim: d.isClaim === true,
      lines,
      showBooking,
      showPayoutRef,
      lineColumns,
      searchText: `${merchant} ${d.accountId}`.toLowerCase(),
    };
  }

  /** Core shape: method / grossAmount / feeAmount / netAmount / refundedAtUtc; older fields are read as fallbacks. */
  private toLine(l: MerchantDebtLine): DebtLineRow {
    const kind = text(l.kind);
    const method = text(l.method);
    return {
      kindKey: kind ? adjustmentKindKey(kind) : null,
      description: text(l.description),
      bookingNumber: text(l.bookingNumber) || EMPTY,
      payoutReference: text(l.payoutReference) || EMPTY,
      methodKey: paymentMethodKey(method),
      method: method || EMPTY,
      gross: num(l.grossAmount),
      fee: num(l.feeAmount),
      net: num(l.netAmount) ?? num(l.amount),
      date: this.fmtDate(text(l.refundedAtUtc) || text(l.occurredAtUtc) || text(l.createdAtUtc) || null),
    };
  }

  private fmtDate(value: string | null | undefined): string {
    const date = parseApiUtc(value ?? null);
    if (!date) return EMPTY;
    return format(date, 'd MMMM yyyy', { locale: this.currentLang === 'en' ? enUS : ar });
  }
}
