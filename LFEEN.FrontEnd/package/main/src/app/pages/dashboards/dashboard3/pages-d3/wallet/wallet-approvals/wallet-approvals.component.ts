import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription } from 'rxjs';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { MaterialModule } from 'src/app/material.module';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import { appLocale } from 'src/app/utils/locale-format.util';
import { WalletAttachment, WalletPendingAdjustment } from '../interfaces/wallet.model';
import { resolveWalletError, walletErrorCode } from '../interfaces/wallet-error.util';
import { WalletService } from '../services/wallet.service';
import {
  WalletDecisionDialogComponent,
  WalletDecisionDialogData,
  WalletDecisionDialogResult,
} from '../components/wallet-decision-dialog/wallet-decision-dialog.component';

interface PendingRow {
  item: WalletPendingAdjustment;
  merchantLabel: string;
  isCredit: boolean;
  amount: number;
  categoryName: string;
  reason: string;
  requestedBy: string | null;
  date: Date | null;
  attachments: WalletAttachment[];
}

const EMPTY = '-';

// Maker-checker queue: adjustments above the threshold wait here until a different
// admin approves or rejects them. The server enforces "not your own request".
@Component({
  selector: 'app-wallet-approvals',
  standalone: true,
  imports: [CommonModule, RouterLink, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './wallet-approvals.component.html',
  styleUrl: './wallet-approvals.component.scss'
})
export class WalletApprovalsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastrService);
  private service = inject(WalletService);

  currentLang = this.translate.currentLang || 'ar';
  loading = false;
  loadError = false;
  forbidden = false;
  rows: PendingRow[] = [];
  /** Request ids with an approve/reject in flight — their buttons are disabled. */
  busy = new Set<string>();

  readonly emptyValue = EMPTY;
  private loadRequest?: Subscription;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLang = event.lang;
        this.rows = this.rows.map(r => this.toRow(r.item));
      });
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

  get isTextCurrency(): boolean {
    return this.currentLang === 'en';
  }

  load(): void {
    this.loadRequest?.unsubscribe();
    this.loading = true;
    this.loadError = false;
    this.forbidden = false;
    this.loadRequest = this.service.getPendingAdjustments().subscribe({
      next: list => {
        this.rows = list.map(i => this.toRow(i));
        this.loading = false;
      },
      error: err => {
        this.rows = [];
        this.loading = false;
        this.loadError = true;
        this.forbidden = (err as { status?: number })?.status === 403;
      },
    });
  }

  fmtAmount(value: number): string {
    return Math.abs(value).toLocaleString(appLocale(this.currentLang), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  formatDate(date: Date | null): string {
    if (!date) return EMPTY;
    const locale = this.currentLang === 'en' ? enUS : ar;
    return `${format(date, 'd MMMM yyyy', { locale })} | ${format(date, 'hh:mm a', { locale })}`;
  }

  approve(row: PendingRow): void {
    this.decide(row, 'approve');
  }

  reject(row: PendingRow): void {
    this.decide(row, 'reject');
  }

  private decide(row: PendingRow, mode: 'approve' | 'reject'): void {
    const id = row.item.id;
    if (this.busy.has(id)) return;
    const ref = this.dialog.open(WalletDecisionDialogComponent, {
      width: '520px',
      maxWidth: '94vw',
      data: {
        mode,
        amountText: `${row.isCredit ? '+' : '−'}${this.fmtAmount(row.amount)}`,
        isCredit: row.isCredit,
        merchantLabel: row.merchantLabel,
        requestedBy: row.requestedBy,
      } as WalletDecisionDialogData,
    });

    ref.afterClosed().subscribe((result?: WalletDecisionDialogResult) => {
      if (!result) return;
      this.busy.add(id);
      const request$: Observable<unknown> = mode === 'approve'
        ? this.service.approveAdjustment(id)
        : this.service.rejectAdjustment(id, result.reason);
      // Never auto-retried; on any failure the list is reloaded so a request
      // handled meanwhile by another admin disappears instead of being retried.
      request$.subscribe({
        next: () => {
          this.busy.delete(id);
          this.rows = this.rows.filter(r => r.item.id !== id);
          this.toastr.success(this.translate.instant(
            mode === 'approve' ? 'd3.wallet.approvals.approvedToast' : 'd3.wallet.approvals.rejectedToast'
          ));
        },
        error: err => {
          this.busy.delete(id);
          this.toastr.error(resolveWalletError(err, this.translate));
          const status = (err as { status?: number })?.status;
          if (status === 404 || status === 409 || walletErrorCode(err)) this.load();
        },
      });
    });
  }

  private toRow(i: WalletPendingAdjustment): PendingRow {
    const categoryName = (this.currentLang === 'en' ? i.categoryNameEn : i.categoryNameAr) || i.category || EMPTY;
    const requestedBy = (i.requestedByAdminName || i.requestedBy || '').trim() || null;
    return {
      item: i,
      merchantLabel: i.merchantName?.trim() || `${i.merchantAccountId.slice(0, 8)}…`,
      isCredit: i.amount > 0,
      amount: i.amount,
      categoryName,
      reason: i.reason?.trim() || EMPTY,
      requestedBy,
      date: parseApiUtc(i.requestedAtUtc ?? i.createdAtUtc ?? ''),
      attachments: i.attachments ?? [],
    };
  }
}
