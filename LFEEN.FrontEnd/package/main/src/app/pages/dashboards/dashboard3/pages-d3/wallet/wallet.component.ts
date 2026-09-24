import { Component, DestroyRef, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { Subscription, forkJoin } from 'rxjs';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import { LoginService } from '../../services/login/login.service';
import { AccountService } from '../../services/account.service';
import { PageTitleOverrideService } from '../../services/page-title-override.service';
import {
  WalletAdjustDialogComponent,
  WalletAdjustDialogData,
  WalletAdjustDialogResult,
} from './components/wallet-adjust-dialog/wallet-adjust-dialog.component';
import {
  WalletEditEntryDialogComponent,
  WalletEditEntryDialogData,
  WalletEditEntryDialogResult,
} from './components/wallet-edit-entry-dialog/wallet-edit-entry-dialog.component';
import {
  MANUAL_ENTRY_TYPE,
  WalletAttachment,
  WalletBalance,
  WalletCategory,
  WalletEntryType,
  WalletLedgerEntry,
} from './interfaces/wallet.model';
import { resolveWalletError } from './interfaces/wallet-error.util';
import { WalletService } from './services/wallet.service';

type TypeFilter = 'all' | WalletEntryType;
type TypeClass = 'type-topup' | 'type-charge' | 'type-refund' | 'type-adjustment' | '';

interface WalletLedgerRow {
  id: string;
  entry: WalletLedgerEntry;
  type: string;
  typeKey: string | null;
  typeIcon: string;
  typeClass: TypeClass;
  categoryName: string;
  amount: number;
  isCredit: boolean;
  balanceAfter: number;
  description: string;
  date: Date | null;
  createdBy: string | null;
  wasEdited: boolean;
  attachments: WalletAttachment[];
  isManual: boolean;
  searchText: string;
}

const PAGE_SIZE = 8;
const EMPTY = '-';

// Backend ledger type → icon/pill color + translation key. The API doesn't localize
// `type`, and unrecognized values must never break the screen — they render as-is.
const TYPE_META: Record<string, { key: string; icon: string; cls: TypeClass }> = {
  TopUp: { key: 'topUp', icon: 'arrow-down-circle', cls: 'type-topup' },
  CallCharge: { key: 'callCharge', icon: 'phone-outgoing', cls: 'type-charge' },
  CallRefundAdjustment: { key: 'callRefund', icon: 'rotate', cls: 'type-refund' },
  AdminAdjustment: { key: 'adminAdjustment', icon: 'user-cog', cls: 'type-adjustment' },
};

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './wallet.component.html',
  styleUrl: './wallet.component.scss'
})
export class WalletComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastrService);
  private service = inject(WalletService);
  private accountService = inject(AccountService);
  private login = inject(LoginService);
  private pageTitleOverride = inject(PageTitleOverrideService);

  readonly canAdjust = computed(() => this.hasPermission('wallet.adjust'));
  readonly canEditEntry = computed(() => this.hasPermission('wallet.editentry'));

  currentLang = this.translate.currentLang || 'ar';
  merchantAccountId = '';
  merchantName = EMPTY;

  loading = false;
  loadError = false;
  forbidden = false;

  balance = 0;
  currencyCode = 'SAR';
  categories: WalletCategory[] = [];

  searchQuery = '';
  typeFilter: TypeFilter = 'all';
  newestFirst = true;
  currentPage = 1;

  private allEntries: WalletLedgerRow[] = [];
  private filtered: WalletLedgerRow[] = [];
  pagedEntries: WalletLedgerRow[] = [];

  private loadRequest?: Subscription;

  readonly typeOptions: { value: TypeFilter; labelKey: string }[] = [
    { value: 'all', labelKey: 'd3.wallet.filters.all' },
    { value: 'TopUp', labelKey: 'd3.wallet.filters.topUp' },
    { value: 'CallCharge', labelKey: 'd3.wallet.filters.callCharge' },
    { value: 'CallRefundAdjustment', labelKey: 'd3.wallet.filters.callRefund' },
    { value: 'AdminAdjustment', labelKey: 'd3.wallet.filters.adminAdjustment' },
  ];

  readonly sortOptions: { value: boolean; labelKey: string }[] = [
    { value: true, labelKey: 'd3.wallet.filters.newest' },
    { value: false, labelKey: 'd3.wallet.filters.oldest' },
  ];

  readonly emptyValue = EMPTY;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLang = event.lang;
        this.rebuildRows();
      });
  }

  ngOnInit(): void {
    this.merchantAccountId = this.route.snapshot.paramMap.get('id') || '';
    this.loadAccountName();
    this.loadCategories();
    this.load();
  }

  ngOnDestroy(): void {
    this.pageTitleOverride.clear();
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get isTextCurrency(): boolean {
    return this.currentLang === 'en';
  }

  get selectedTypeLabelKey(): string {
    return this.typeOptions.find(o => o.value === this.typeFilter)?.labelKey ?? 'd3.wallet.filters.all';
  }

  get selectedSortLabelKey(): string {
    return this.sortOptions.find(o => o.value === this.newestFirst)?.labelKey ?? 'd3.wallet.filters.newest';
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  fmtAmount(value: number): string {
    return Math.abs(value).toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  formatSize(bytes: number): string {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  // Best-effort: the wallet screen still works fine if this fails, it just falls
  // back to showing no trade name.
  private loadAccountName(): void {
    if (!this.merchantAccountId) return;
    this.accountService.getAccountById(this.merchantAccountId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => {
        const business = detail.business;
        const name = (this.currentLang === 'ar' ? business?.tradeNameAr : business?.tradeNameEn)
          || business?.tradeName || business?.tradeNameAr || business?.tradeNameEn || '';
        this.merchantName = name.trim() || EMPTY;
        this.pageTitleOverride.set(this.merchantName !== EMPTY ? this.merchantName : null);
      },
      error: () => {},
    });
  }

  // Needed only by the adjust/edit forms; if it fails the buttons stay available and
  // retry the (uncached-on-error) request when opened.
  private loadCategories(): void {
    this.service.getCategories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => { this.categories = list; },
      error: () => {},
    });
  }

  load(): void {
    if (!this.merchantAccountId) return;
    this.loadRequest?.unsubscribe();
    this.loading = true;
    this.loadError = false;
    this.forbidden = false;

    this.loadRequest = forkJoin({
      balance: this.service.getBalance(this.merchantAccountId),
      ledger: this.service.getLedger(this.merchantAccountId),
    }).subscribe({
      next: ({ balance, ledger }) => {
        this.applyBalance(balance);
        this.allEntries = ledger.map(e => this.toRow(e));
        this.loading = false;
        this.applyFilters();
      },
      error: err => {
        this.allEntries = [];
        this.loading = false;
        this.loadError = true;
        this.forbidden = (err as { status?: number })?.status === 403;
        this.applyFilters();
        if (this.forbidden) {
          this.toastr.error(resolveWalletError(err, this.translate));
        }
      },
    });
  }

  private applyBalance(balance: WalletBalance): void {
    this.balance = balance.balance;
    this.currencyCode = balance.currencyCode;
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.currentPage = 1;
    this.applyFilters();
  }

  onTypeChange(value: TypeFilter): void {
    this.typeFilter = value;
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

  formatEntryDate(date: Date | null): string {
    if (!date) return EMPTY;
    const locale = this.currentLang === 'en' ? enUS : ar;
    return `${format(date, 'd MMMM yyyy', { locale })} | ${format(date, 'hh:mm a', { locale })}`;
  }

  openAdjustDialog(): void {
    this.openAdjust();
  }

  openCorrectionDialog(row: WalletLedgerRow): void {
    this.openAdjust({
      entryId: row.id,
      signedAmount: row.isCredit ? row.amount : -row.amount,
      createdAtUtc: row.entry.createdAtUtc,
    });
  }

  private openAdjust(correction?: WalletAdjustDialogData['correction']): void {
    if (!this.canAdjust()) return;
    this.withCategories(categories => {
      const dialogRef = this.dialog.open(WalletAdjustDialogComponent, {
        width: '640px',
        maxWidth: '94vw',
        panelClass: 'wallet-adjust-panel',
        data: {
          merchantAccountId: this.merchantAccountId,
          currentBalance: this.balance,
          currencyIconSrc: this.currencyIconSrc,
          isTextCurrency: this.isTextCurrency,
          categories,
          correction,
        } as WalletAdjustDialogData
      });

      // The response carries the new balance and the new entry's id, not the ledger
      // itself, so the ledger is re-fetched to show the entry immediately.
      dialogRef.afterClosed().subscribe((result?: WalletAdjustDialogResult) => {
        if (!result) return;
        this.balance = result.newBalance;
        this.load();
      });
    });
  }

  openEditDialog(row: WalletLedgerRow): void {
    if (!this.canEditEntry() || !row.isManual) return;
    this.withCategories(categories => {
      const dialogRef = this.dialog.open(WalletEditEntryDialogComponent, {
        width: '640px',
        maxWidth: '94vw',
        panelClass: 'wallet-adjust-panel',
        data: {
          merchantAccountId: this.merchantAccountId,
          entry: row.entry,
          categories,
        } as WalletEditEntryDialogData
      });

      // The PUT returns the whole updated entry — swap the row in place, no refetch.
      dialogRef.afterClosed().subscribe((updated?: WalletEditEntryDialogResult) => {
        if (!updated) return;
        this.allEntries = this.allEntries.map(r => (r.id === updated.id ? this.toRow(updated) : r));
        this.applyFilters();
      });
    });
  }

  private withCategories(open: (categories: WalletCategory[]) => void): void {
    if (this.categories.length) { open(this.categories); return; }
    this.service.getCategories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => { this.categories = list; open(list); },
      error: err => this.toastr.error(resolveWalletError(err, this.translate)),
    });
  }

  private toRow(e: WalletLedgerEntry): WalletLedgerRow {
    const meta = TYPE_META[e.type];
    const description = e.description?.trim() || EMPTY;
    const categoryName = (this.currentLang === 'en' ? e.categoryNameEn : e.categoryNameAr) || EMPTY;
    return {
      id: e.id,
      entry: e,
      type: e.type,
      typeKey: meta ? `d3.wallet.types.${meta.key}` : null,
      typeIcon: meta?.icon ?? 'receipt',
      typeClass: meta?.cls ?? '',
      categoryName,
      amount: e.amount,
      isCredit: e.direction === 'Credit',
      balanceAfter: e.balanceAfterOperation,
      description,
      date: parseApiUtc(e.createdAtUtc),
      createdBy: e.createdBy?.trim() || null,
      wasEdited: !!e.updatedAtUtc,
      attachments: e.attachments ?? [],
      isManual: e.type === MANUAL_ENTRY_TYPE,
      searchText: description.toLowerCase(),
    };
  }

  // The category name follows the UI language, so rows are rebuilt on a language switch.
  private rebuildRows(): void {
    this.allEntries = this.allEntries.map(r => this.toRow(r.entry));
    this.applyFilters();
  }

  private applyFilters(): void {
    const q = this.searchQuery.trim().toLowerCase();
    let list = this.typeFilter === 'all' ? [...this.allEntries] : this.allEntries.filter(r => r.type === this.typeFilter);
    if (q) list = list.filter(r => r.searchText.includes(q));
    const time = (r: WalletLedgerRow) => r.date?.getTime() ?? 0;
    list.sort((a, b) => (this.newestFirst ? time(b) - time(a) : time(a) - time(b)));
    this.filtered = list;
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    this.updatePage();
  }

  private updatePage(): void {
    const start = (this.currentPage - 1) * PAGE_SIZE;
    this.pagedEntries = this.filtered.slice(start, start + PAGE_SIZE);
  }

  private hasPermission(permission: string): boolean {
    return this.login.permissions().some(p => p.toLowerCase() === permission);
  }
}
