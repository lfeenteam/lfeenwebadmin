import { CommonModule } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { MaterialModule } from 'src/app/material.module';
import { MatDialog } from '@angular/material/dialog';
import { CoreService } from 'src/app/services/core.service';
import { OfferConfirmDialogComponent } from './components/offer-confirm-dialog/offer-confirm-dialog.component';
import { getVisiblePages } from 'src/app/utils/pagination.util';
import { extractApiErrorMessage } from '../../utils/api-error.util';
import {
  OfferTriggerType,
  PlatformOfferListItem,
} from './interfaces/platform-offer.model';
import { PlatformOffersService } from './services/platform-offers.service';

@Component({
  selector: 'app-platform-offers-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslateModule,
    TablerIconsModule,
    DashboardLoadingComponent,
    MaterialModule,
  ],
  templateUrl: './platform-offers-list.component.html',
  styleUrl: './platform-offers.component.scss',
})
export class PlatformOffersListComponent implements OnInit, OnDestroy {
  private service = inject(PlatformOffersService);
  private core = inject(CoreService);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private search$ = new Subject<string>();
  private destroy$ = new Subject<void>();
  dir = computed(() => this.core.getOptionsSignal()().dir);
  items = signal<PlatformOfferListItem[]>([]);
  loading = signal(false);
  error = signal('');
  busyId = signal<number | null>(null);
  search = '';
  triggerType = '';
  offerStatus = '';
  minDiscount?: number;
  maxDiscount?: number;
  startDateFrom = '';
  startDateTo = '';
  page = signal(1);
  pageSize = 20;
  total = signal(0);
  pages = signal(1);
  ngOnInit() {
    this.search$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page.set(1);
        this.load();
      });
    this.load();
  }
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
  onSearch(v: string) {
    this.search = v;
    this.search$.next(v.trim());
  }
  apply() {
    this.page.set(1);
    this.load();
  }
  reset() {
    this.search = '';
    this.triggerType = '';
    this.offerStatus = '';
    this.minDiscount = undefined;
    this.maxDiscount = undefined;
    this.startDateFrom = '';
    this.startDateTo = '';
    this.apply();
  }
  load() {
    this.loading.set(true);
    this.error.set('');
    this.service
      .list({
        search: this.search.trim() || undefined,
        triggerType: (this.triggerType as OfferTriggerType) || undefined,
        offerStatus: this.offerStatus || undefined,
        minDiscount: this.minDiscount,
        maxDiscount: this.maxDiscount,
        startDateFrom: this.startDateFrom || undefined,
        startDateTo: this.startDateTo || undefined,
        pageNumber: this.page(),
        pageSize: this.pageSize,
      })
      .subscribe({
        next: (r) => {
          this.items.set(r.data || []);
          this.total.set(r.totalCount || 0);
          this.pages.set(Math.max(1, r.totalPages || 1));
          this.loading.set(false);
        },
        // The list's own error state only ever shows the localized fallback text — the
        // raw backend/network message (e.g. an infra-level "API request failed.") is a
        // debugging detail, not something to surface on this page.
        error: () => {
          this.error.set(this.translate.instant('d3.platformOffers.errors.load'));
          this.loading.set(false);
        },
      });
  }
  goto(p: number) {
    if (p > 0 && p <= this.pages() && p !== this.page()) {
      this.page.set(p);
      this.load();
    }
  }
  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.page(), this.pages());
  }
  status(item: PlatformOfferListItem) {
    if (item.isExpired) return 'expired';
    if (!item.isActive) return 'inactive';
    return item.statusEn?.trim().toLowerCase() === 'scheduled'
      ? 'scheduled'
      : 'active';
  }
  discount(item: PlatformOfferListItem) {
    return item.discountType === 'Percentage'
      ? `${item.discountValue}%`
      : item.discountValue.toLocaleString();
  }
  formatListDate(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat(this.dir() === 'rtl' ? 'ar-EG' : 'en-US', {
      day: 'numeric', month: 'short', year: 'numeric',
    }).format(date);
  }
  enumLabel(value: string): string {
    return this.translate.instant(`d3.platformOffers.enums.${value}`);
  }
  toggle(item: PlatformOfferListItem) {
    const activating = !item.isActive;
    const ref = this.dialog.open(OfferConfirmDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      panelClass: 'custom-confirm-dialog',
      data: {
        title: activating ? 'd3.platformOffers.confirm.activateTitle' : 'd3.platformOffers.confirm.deactivateTitle',
        message: activating ? 'd3.platformOffers.confirm.activateMessage' : 'd3.platformOffers.confirm.deactivateMessage',
        confirmLabel: activating ? 'd3.platformOffers.confirm.activateAction' : 'd3.platformOffers.confirm.deactivateAction',
        icon: activating ? 'player-play' : 'player-pause',
        tone: activating ? 'success' : 'warning',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) this.changeStatus(item);
    });
  }
  private changeStatus(item: PlatformOfferListItem) {
    this.busyId.set(item.id);
    this.service.setActive(item.id, !item.isActive).subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
        this.toastr.success(this.translate.instant('d3.platformOffers.saved'));
      },
      error: (e) => {
        this.busyId.set(null);
        this.toastr.error(
          extractApiErrorMessage(
            e,
            this.translate.instant('d3.platformOffers.errors.action'),
          ),
        );
      },
    });
  }
  remove(item: PlatformOfferListItem) {
    const ref = this.dialog.open(OfferConfirmDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      panelClass: 'custom-confirm-dialog',
      data: {
        title: 'd3.platformOffers.confirm.deleteTitle',
        message: 'd3.platformOffers.confirm.deleteMessage',
        confirmLabel: 'd3.platformOffers.confirm.deleteAction',
        icon: 'trash',
        tone: 'danger',
      },
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (confirmed) this.deleteOffer(item);
    });
  }
  private deleteOffer(item: PlatformOfferListItem) {
    this.busyId.set(item.id);
    this.service.delete(item.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
        this.toastr.success(
          this.translate.instant('d3.platformOffers.deleted'),
        );
      },
      error: (e) => {
        this.busyId.set(null);
        this.toastr.error(
          extractApiErrorMessage(
            e,
            this.translate.instant('d3.platformOffers.errors.action'),
          ),
        );
      },
    });
  }
  lang() {
    return this.router.url.split('/')[1] || 'ar';
  }
  createLink() {
    return ['/', this.lang(), 'd3', 'platform-offers', 'create'];
  }
  editLink(id: number) {
    return ['/', this.lang(), 'd3', 'platform-offers', id, 'edit'];
  }
  open(id: number) {
    this.router.navigate(['/', this.lang(), 'd3', 'platform-offers', id]);
  }
}
