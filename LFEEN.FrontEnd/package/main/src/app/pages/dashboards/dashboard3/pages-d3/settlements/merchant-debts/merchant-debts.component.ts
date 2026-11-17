import { Component, DestroyRef, OnInit, inject } from '@angular/core';
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
import { SettlementsService } from '../services/settlements.service';

interface DebtLineRow {
  kindKey: string | null;
  kind: string;
  description: string;
  bookingNumber: string;
  payoutReference: string;
  amount: number | null;
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
  searchText: string;
}

const EMPTY = '-';

const LINE_KIND_KEYS: Record<string, string> = {
  RefundAfterPayout: 'd3.settlements.recalc.kind.refundAfterPayout',
  RefundAfterSettlement: 'd3.settlements.recalc.kind.refundAfterSettlement',
};

/** Merchant settlement debts (BUG-1482) — read-only mirror of GET /api/settlements/debts. */
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

  backToSettlements(): void {
    const lang = this.router.url.split('/')[1] || 'ar';
    this.router.navigate(['/', lang, 'd3', 'settlements']);
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
    const merchant = d.merchantName?.trim() || d.accountId;
    return {
      accountId: d.accountId,
      merchant,
      outstandingClawbackNet: d.outstandingClawbackNet ?? 0,
      unsettledDuesNet: d.unsettledDuesNet ?? 0,
      balance: d.balance ?? 0,
      since: this.fmtDate(d.sinceUtc),
      isClaim: d.isClaim === true,
      lines: (d.lines ?? []).map(l => this.toLine(l)),
      searchText: `${merchant} ${d.accountId}`.toLowerCase(),
    };
  }

  private toLine(l: MerchantDebtLine): DebtLineRow {
    const kind = (l.kind ?? '').toString();
    const amount = typeof l.netAmount === 'number' ? l.netAmount : typeof l.amount === 'number' ? l.amount : null;
    return {
      kindKey: LINE_KIND_KEYS[kind] ?? null,
      kind: kind || EMPTY,
      description: l.description?.toString().trim() || '',
      bookingNumber: l.bookingNumber?.toString().trim() || EMPTY,
      payoutReference: l.payoutReference?.toString().trim() || EMPTY,
      amount,
      date: this.fmtDate((l.occurredAtUtc ?? l.createdAtUtc ?? null) as string | null),
    };
  }

  private fmtDate(value: string | null | undefined): string {
    const date = parseApiUtc(value ?? null);
    if (!date) return EMPTY;
    return format(date, 'd MMMM yyyy', { locale: this.currentLang === 'en' ? enUS : ar });
  }
}
