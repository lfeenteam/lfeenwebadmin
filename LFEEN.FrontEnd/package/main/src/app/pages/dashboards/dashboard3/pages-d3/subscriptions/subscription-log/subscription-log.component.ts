import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Subscription, catchError, of } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { SubscriptionsService } from '../../../services/subscriptions.service';
import { SubscriptionAuditLog, SubscriptionCatalogItem } from '../interfaces/subscription.model';
import { resolveSubscriptionError } from '../interfaces/subscription-error.util';

type ActionTone = 'add' | 'renew' | 'cancel' | 'neutral';

interface LogRow {
  id: number;
  merchantName: string;
  actionLabel: string;
  actionTone: ActionTone;
  serviceName: string;
  actorLabel: string;
  actorInitial: string;
  date: string;
  details: string;
}

const PAGE_SIZE = 20;

@Component({
  selector: 'app-subscription-log',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './subscription-log.component.html',
  styleUrl: './subscription-log.component.scss'
})
export class SubscriptionLogComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private subscriptionsService = inject(SubscriptionsService);

  isLoading = true;
  /** null = all services. */
  serviceFilter: number | null = null;
  currentPage = 1;
  totalPages = 1;
  totalCount = 0;

  entries: LogRow[] = [];
  services: SubscriptionCatalogItem[] = [];

  private pageRequest?: Subscription;

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  get selectedServiceLabel(): string {
    const s = this.services.find(x => x.id === this.serviceFilter);
    return s ? this.serviceName(s) : this.translate.instant('d3.subscriptionLog.filters.allServices');
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  serviceName(s: SubscriptionCatalogItem): string {
    return this.currentLang === 'en' ? s.nameEn : s.nameAr;
  }

  ngOnInit(): void {
    this.subscriptionsService.getCatalog()
      .pipe(catchError(() => of([] as SubscriptionCatalogItem[])), takeUntilDestroyed(this.destroyRef))
      .subscribe(catalog => {
        this.services = [...catalog].sort((a, b) => a.displayOrder - b.displayOrder);
      });
    this.loadPage();
  }

  private loadPage(): void {
    this.pageRequest?.unsubscribe();
    this.isLoading = true;
    this.pageRequest = this.subscriptionsService.getActivityLog({
      subscriptionServiceId: this.serviceFilter ?? undefined,
      pageNumber: this.currentPage,
      pageSize: PAGE_SIZE,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.entries = (res.data ?? []).map(e => this.toRow(e));
        this.totalCount = res.totalCount ?? this.entries.length;
        this.totalPages = Math.max(1, res.totalPages ?? 1);
        this.isLoading = false;
      },
      error: err => {
        this.entries = [];
        this.totalCount = 0;
        this.totalPages = 1;
        this.isLoading = false;
        this.toastr.error(resolveSubscriptionError(err, this.translate));
      }
    });
  }

  private toRow(e: SubscriptionAuditLog): LogRow {
    const actor = this.labelFor('actor', e.actorType);
    return {
      id: e.id,
      merchantName: e.merchantName?.trim() || '-',
      actionLabel: this.labelFor('actions', e.action),
      actionTone: this.actionTone(e.action),
      serviceName: e.serviceName?.trim() || '-',
      actorLabel: actor,
      actorInitial: actor !== '-' ? actor.charAt(0).toUpperCase() : '-',
      date: formatApiDateLocal(e.createdAt, this.currentLang, true) ?? '-',
      details: e.details?.trim() || '-',
    };
  }

  // action/actorType have no Label fields and their value lists aren't confirmed yet —
  // known values get our translation, anything else is shown as the raw value.
  private labelFor(group: 'actions' | 'actor', raw: string | null): string {
    if (!raw) return '-';
    const key = `d3.subscriptionLog.${group}.${raw}`;
    const translated = this.translate.instant(key);
    return translated === key ? raw : translated;
  }

  // Only picks a badge color — the text always comes from the raw value / its translation.
  private actionTone(action: string | null): ActionTone {
    const a = (action ?? '').toLowerCase();
    if (a.includes('renew')) return 'renew';
    if (a.includes('reject') || a.includes('cancel') || a.includes('deactiv') || a.includes('suspend') || a.includes('expire')) return 'cancel';
    if (a.includes('approv') || a.includes('activ') || a.includes('creat') || a.includes('request') || a.includes('subscrib')) return 'add';
    return 'neutral';
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  onServiceFilterChange(value: number | null): void {
    this.serviceFilter = value;
    this.currentPage = 1;
    this.loadPage();
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadPage();
  }
}
