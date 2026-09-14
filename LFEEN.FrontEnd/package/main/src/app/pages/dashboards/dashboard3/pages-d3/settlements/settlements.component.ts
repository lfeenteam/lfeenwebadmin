import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { format, isToday, isYesterday } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { SettlementDetailDialogComponent, SettlementDetailDialogData } from './components/settlement-detail-dialog/settlement-detail-dialog.component';

type SettlementTab = 'current' | 'previous';
type SettlementStatus = 'pending' | 'approved' | 'rejected';
type PaymentMethod = 'bank_transfer' | 'mada';

interface SettlementRow {
  id: string;
  accountInitials: string;
  partyName: string;
  ownerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  requestDate: Date;
  status: SettlementStatus;
  /** Only set for rejected rows with a preset (mock) reason — an i18n key. */
  rejectionReasonKey?: string;
  /** Only set for rows rejected manually from the dialog — the admin's free-text reason. */
  rejectionReasonText?: string;
  hostName: string;
  phone: string;
  bankAccountHolder: string;
  bankName: string;
  bankAccountNumber: string;
  iban: string;
  bankVerified: boolean;
}

const PAGE_SIZE = 8;

// Mock data until a settlements API is wired up — mirrors the shape returned
// by a typical paginated list endpoint so swapping in a real service later
// only touches ngOnInit.
const MOCK_SETTLEMENTS: SettlementRow[] = [
  { id: 's1', accountInitials: 'AN', partyName: 'شركة الثور العقارية', ownerName: 'شركة حلول', amount: 8400, paymentMethod: 'bank_transfer', requestDate: new Date(new Date().setHours(0, 30, 0, 0)), status: 'pending', hostName: 'أحمد العلي', phone: '0504499221', bankAccountHolder: 'أحمد العلي', bankName: 'مصرف الراجحي', bankAccountNumber: '1234567890', iban: 'SA60 8000 0000 1234 5678 9012', bankVerified: true },
  { id: 's2', accountInitials: 'AN', partyName: 'شركة الثور العقارية', ownerName: 'شركة حلول', amount: 8400, paymentMethod: 'mada', requestDate: new Date(new Date(Date.now() - 86400000).setHours(16, 11, 0, 0)), status: 'pending', hostName: 'أحمد العلي', phone: '0504499221', bankAccountHolder: 'أحمد العلي', bankName: 'مصرف الراجحي', bankAccountNumber: '1234567890', iban: 'SA60 8000 0000 1234 5678 9012', bankVerified: true },
  { id: 's3', accountInitials: 'AN', partyName: 'شركة الثور العقارية', ownerName: 'شركة حلول', amount: 8400, paymentMethod: 'bank_transfer', requestDate: new Date(new Date().getFullYear(), 9, 12, 9, 8), status: 'pending', hostName: 'أحمد العلي', phone: '0504499221', bankAccountHolder: 'أحمد العلي', bankName: 'مصرف الراجحي', bankAccountNumber: '1234567890', iban: 'SA60 8000 0000 1234 5678 9012', bankVerified: false },
  { id: 's4', accountInitials: 'AN', partyName: 'شركة الثور العقارية', ownerName: 'شركة حلول', amount: 8400, paymentMethod: 'bank_transfer', requestDate: new Date(2023, 9, 14, 9, 45), status: 'approved', hostName: 'أحمد العلي', phone: '0504499221', bankAccountHolder: 'أحمد العلي', bankName: 'مصرف الراجحي', bankAccountNumber: '1234567890', iban: 'SA60 8000 0000 1234 5678 9012', bankVerified: true },
  { id: 's5', accountInitials: 'AN', partyName: 'شركة الثور العقارية', ownerName: 'شركة حلول', amount: 8400, paymentMethod: 'mada', requestDate: new Date(2023, 9, 14, 8, 10), status: 'rejected', rejectionReasonKey: 'd3.settlements.rejectionReasons.unclearImage', hostName: 'أحمد العلي', phone: '0504499221', bankAccountHolder: 'أحمد العلي', bankName: 'مصرف الراجحي', bankAccountNumber: '1234567890', iban: 'SA60 8000 0000 1234 5678 9012', bankVerified: false },
  { id: 's6', accountInitials: 'AN', partyName: 'شركة الثور العقارية', ownerName: 'شركة حلول', amount: 8400, paymentMethod: 'bank_transfer', requestDate: new Date(2023, 9, 13, 5, 30), status: 'approved', hostName: 'أحمد العلي', phone: '0504499221', bankAccountHolder: 'أحمد العلي', bankName: 'مصرف الراجحي', bankAccountNumber: '1234567890', iban: 'SA60 8000 0000 1234 5678 9012', bankVerified: true },
  { id: 's7', accountInitials: 'AN', partyName: 'شركة الثور العقارية', ownerName: 'شركة حلول', amount: 8400, paymentMethod: 'mada', requestDate: new Date(2023, 9, 13, 9, 15), status: 'approved', hostName: 'أحمد العلي', phone: '0504499221', bankAccountHolder: 'أحمد العلي', bankName: 'مصرف الراجحي', bankAccountNumber: '1234567890', iban: 'SA60 8000 0000 1234 5678 9012', bankVerified: true },
  { id: 's8', accountInitials: 'AN', partyName: 'شركة الثور العقارية', ownerName: 'شركة حلول', amount: 8400, paymentMethod: 'bank_transfer', requestDate: new Date(2023, 9, 12, 11, 20), status: 'rejected', rejectionReasonKey: 'd3.settlements.rejectionReasons.accountMismatch', hostName: 'أحمد العلي', phone: '0504499221', bankAccountHolder: 'أحمد العلي', bankName: 'مصرف الراجحي', bankAccountNumber: '1234567890', iban: 'SA60 8000 0000 1234 5678 9012', bankVerified: false },
  { id: 's9', accountInitials: 'AN', partyName: 'شركة الثور العقارية', ownerName: 'شركة حلول', amount: 8400, paymentMethod: 'mada', requestDate: new Date(2023, 9, 11, 3, 40), status: 'approved', hostName: 'أحمد العلي', phone: '0504499221', bankAccountHolder: 'أحمد العلي', bankName: 'مصرف الراجحي', bankAccountNumber: '1234567890', iban: 'SA60 8000 0000 1234 5678 9012', bankVerified: true },
];

@Component({
  selector: 'app-settlements',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent],
  templateUrl: './settlements.component.html',
  styleUrl: './settlements.component.scss'
})
export class SettlementsComponent {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private dialog = inject(MatDialog);

  currentLang = this.translate.currentLang || 'ar';
  activeTab: SettlementTab = 'current';
  searchQuery = '';
  newestFirst = true;
  currentPage = 1;

  private allSettlements: SettlementRow[] = MOCK_SETTLEMENTS;

  readonly sortOptions: { value: boolean; labelKey: string }[] = [
    { value: true, labelKey: 'd3.settlements.filters.newest' },
    { value: false, labelKey: 'd3.settlements.filters.oldest' },
  ];

  readonly maxPaymentHours = 48;
  readonly avgRequestValue = 45280;
  readonly totalPendingAmount = 45280;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });
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

  setActiveTab(tab: SettlementTab): void {
    this.activeTab = tab;
    this.currentPage = 1;
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.currentPage = 1;
  }

  onSortChange(value: boolean): void {
    this.newestFirst = value;
    this.currentPage = 1;
  }

  private get tabSettlements(): SettlementRow[] {
    return this.allSettlements.filter(s =>
      this.activeTab === 'current' ? s.status === 'pending' : s.status !== 'pending'
    );
  }

  private get filteredBeforePaging(): SettlementRow[] {
    let list = this.tabSettlements;
    const q = this.searchQuery.trim();
    if (q) {
      list = list.filter(s => s.partyName.includes(q) || s.ownerName.includes(q) || s.id.includes(q));
    }
    return [...list].sort((a, b) =>
      this.newestFirst
        ? b.requestDate.getTime() - a.requestDate.getTime()
        : a.requestDate.getTime() - b.requestDate.getTime()
    );
  }

  get pagedSettlements(): SettlementRow[] {
    const start = (this.currentPage - 1) * PAGE_SIZE;
    return this.filteredBeforePaging.slice(start, start + PAGE_SIZE);
  }

  get totalCount(): number {
    return this.filteredBeforePaging.length;
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
  }

  paymentMethodIcon(method: PaymentMethod): string {
    return method === 'bank_transfer' ? 'building-bank' : 'wifi';
  }

  paymentMethodLabelKey(method: PaymentMethod): string {
    return method === 'bank_transfer'
      ? 'd3.settlements.paymentMethods.bankTransfer'
      : 'd3.settlements.paymentMethods.mada';
  }

  statusLabelKey(status: SettlementStatus): string {
    return `d3.settlements.status.${status}`;
  }

  // Pending requests read best as relative/compact ("Today 12:30 AM"); settled
  // history reads best as an exact, auditable date ("14 October 2023 | 09:45 AM").
  formatRequestDate(date: Date): string {
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

  onView(settlement: SettlementRow): void {
    const dialogRef = this.dialog.open(SettlementDetailDialogComponent, {
      width: '480px',
      maxWidth: '92vw',
      panelClass: 'settlement-detail-panel',
      data: {
        accountName: settlement.partyName,
        hostName: settlement.hostName,
        phone: settlement.phone,
        amountFormatted: this.fmtAmount(settlement.amount),
        currencyIconSrc: this.currencyIconSrc,
        isTextCurrency: this.currentLang === 'en',
        bankAccountHolder: settlement.bankAccountHolder,
        bankName: settlement.bankName,
        bankAccountNumber: settlement.bankAccountNumber,
        iban: settlement.iban,
        bankVerified: settlement.bankVerified,
        paymentMethodKey: this.paymentMethodLabelKey(settlement.paymentMethod),
        paymentMethodIconName: this.paymentMethodIcon(settlement.paymentMethod),
      } as SettlementDetailDialogData
    });

    dialogRef.afterClosed().subscribe((result?: { decision: 'approved' } | { decision: 'rejected'; reason: string }) => {
      if (!result || settlement.status !== 'pending') return;
      settlement.status = result.decision;
      if (result.decision === 'rejected') {
        settlement.rejectionReasonText = result.reason;
      }
    });
  }
}
