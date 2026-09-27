import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { catchError, forkJoin, of } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { LoginService } from '../../../services/login/login.service';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import { OfferConfirmDialogComponent, OfferConfirmDialogData } from '../../platform-offers/components/offer-confirm-dialog/offer-confirm-dialog.component';
import { DiscountCodeState, SubscriptionCatalogItem, SubscriptionDiscountCode } from '../interfaces/subscription.model';
import { isStaleSubscriptionError, resolveSubscriptionError } from '../interfaces/subscription-error.util';
import { discountCodeState, isPercentageDiscount } from './discount-code.util';
import { CreateDiscountCodeDialogComponent, CreateDiscountCodeDialogData } from './create-discount-code-dialog/create-discount-code-dialog.component';

interface DiscountCodeRow {
  code: SubscriptionDiscountCode;
  serviceName: string | null;
  isPercentage: boolean;
  state: DiscountCodeState;
  /** 0–100, only when maxRedemptions is set. */
  usagePercent: number | null;
}

@Component({
  selector: 'app-subscription-discount-codes',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './subscription-discount-codes.component.html',
  styleUrl: './subscription-discount-codes.component.scss'
})
export class SubscriptionDiscountCodesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private dialog = inject(MatDialog);
  private service = inject(SubscriptionsService);
  private login = inject(LoginService);

  loading = true;
  loadError = false;
  rows: DiscountCodeRow[] = [];
  togglingId: number | null = null;

  private catalog: SubscriptionCatalogItem[] = [];

  ngOnInit(): void {
    this.load();
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get currencyIconEn(): boolean {
    return this.currentLang === 'en';
  }

  get canManage(): boolean {
    return this.login.permissions().some(p => p.toLowerCase() === 'subscriptions.managediscounts');
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  fmtAmount(value: number): string {
    return value.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA', { maximumFractionDigits: 2 });
  }

  formatDate(iso: string | null): string | null {
    return formatApiDateLocal(iso, this.currentLang);
  }

  load(): void {
    this.loading = true;
    this.loadError = false;
    forkJoin({
      codes: this.service.getDiscountCodes(),
      // Only used for service names in the create dialog and as a fallback label.
      catalog: this.service.getCatalog().pipe(catchError(() => of([] as SubscriptionCatalogItem[]))),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ codes, catalog }) => {
        this.catalog = catalog;
        this.rows = codes.map(c => this.toRow(c));
        this.loading = false;
      },
      error: err => {
        this.rows = [];
        this.loading = false;
        this.loadError = true;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      },
    });
  }

  copyCode(row: DiscountCodeRow): void {
    navigator.clipboard?.writeText(row.code.code).then(() => {
      this.toastr.success(this.translate.instant('d3.discountCodes.copied'));
    });
  }

  openCreate(): void {
    if (!this.canManage) return;
    const ref = this.dialog.open(CreateDiscountCodeDialogComponent, {
      width: '520px',
      maxWidth: '94vw',
      panelClass: 'create-discount-code-panel',
      data: { services: this.catalog } as CreateDiscountCodeDialogData,
    });
    ref.afterClosed().subscribe((created?: SubscriptionDiscountCode) => {
      if (created) this.rows = [this.toRow(created), ...this.rows];
    });
  }

  toggleActive(row: DiscountCodeRow): void {
    if (!this.canManage || this.togglingId !== null) return;
    const activating = !row.code.isActive;

    if (activating) {
      this.applyToggle(row, true);
      return;
    }

    const ref = this.dialog.open(OfferConfirmDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      panelClass: 'custom-confirm-dialog',
      data: {
        title: 'd3.discountCodes.confirmDeactivate.title',
        message: 'd3.discountCodes.confirmDeactivate.message',
        confirmLabel: 'd3.discountCodes.confirmDeactivate.action',
        icon: 'player-pause',
        tone: 'warning',
      } as OfferConfirmDialogData,
    });
    ref.afterClosed().subscribe(confirmed => {
      if (confirmed) this.applyToggle(row, false);
    });
  }

  private applyToggle(row: DiscountCodeRow, active: boolean): void {
    this.togglingId = row.code.id;
    this.service.setDiscountCodeActive(row.code.id, active).subscribe({
      next: updated => {
        this.togglingId = null;
        const idx = this.rows.findIndex(r => r.code.id === row.code.id);
        if (idx >= 0) this.rows[idx] = this.toRow(updated);
      },
      error: err => {
        this.togglingId = null;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
        if (isStaleSubscriptionError(err)) this.load();
      },
    });
  }

  private toRow(code: SubscriptionDiscountCode): DiscountCodeRow {
    const catalogItem = code.subscriptionServiceId != null ? this.catalog.find(c => c.id === code.subscriptionServiceId) : undefined;
    const catalogName = catalogItem ? (this.currentLang === 'en' ? catalogItem.nameEn : catalogItem.nameAr) : null;
    const max = code.maxRedemptions;
    return {
      code,
      serviceName: code.subscriptionServiceId == null ? null : (code.serviceName || catalogName || '-'),
      isPercentage: isPercentageDiscount(code.discountType),
      state: discountCodeState(code),
      usagePercent: max ? Math.min(100, Math.round((code.redemptionCount / max) * 100)) : null,
    };
  }
}
