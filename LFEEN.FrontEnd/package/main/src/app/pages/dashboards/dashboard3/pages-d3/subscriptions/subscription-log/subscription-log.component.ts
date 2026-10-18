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
  /** The first few meaningful "Key=Value" pairs; empty when `details` is free text (see detailsText). */
  detailPairs: DetailPair[];
  /** How many more pairs exist beyond the ones shown. */
  detailsMore: number;
  /** Every pair as one line, for the "+N" tooltip. */
  detailsTooltip: string;
  detailsText: string;
}

interface DetailPair {
  label: string;
  value: string;
  /** Set when the entry records a change ("Old->New"): the previous value. */
  from?: string;
}

/** Most pairs shown in a row before the rest collapses into "+N". */
const MAX_DETAILS = 5;
// Already shown in the row's own columns, so repeating them in the details is noise.
const HIDDEN_DETAIL_KEYS = new Set(['Key', 'NameAr', 'NameEn', 'ServiceKey']);

// `details` on system-generated entries is a technical "Key=Value, Key=Value" string.
const DETAIL_PAIR = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;

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
  /** 'all' rather than null: mat-select renders a null value as an empty field. */
  serviceFilter: number | 'all' = 'all';
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
      subscriptionServiceId: this.serviceFilter === 'all' ? undefined : this.serviceFilter,
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
      ...this.parseDetails(e.details),
    };
  }

  // Splits "Price=100, Setup=0" into labelled pairs. Anything that isn't entirely made of
  // Key=Value parts (an admin's note, a rejection reason) is kept as plain text.
  private parseDetails(raw: string | null): Pick<LogRow, 'detailPairs' | 'detailsMore' | 'detailsTooltip' | 'detailsText'> {
    const empty = { detailPairs: [], detailsMore: 0, detailsTooltip: '' };
    const text = raw?.trim() ?? '';
    if (!text) return { ...empty, detailsText: '—' };

    const matches = text.split(',').map(part => DETAIL_PAIR.exec(part));
    if (matches.some(m => !m)) return { ...empty, detailsText: text };

    const pairs: DetailPair[] = [];
    for (const m of matches) {
      const key = m![1];
      const value = m![2];
      if (HIDDEN_DETAIL_KEYS.has(key)) continue;
      // "Deactivated…=0" counters: nothing was closed, so there's nothing to report.
      if (key.startsWith('Deactivated') && value === '0') continue;

      // An edit is logged as "Old->New" for every field, including the ones that didn't change.
      const change = value.split('->');
      if (change.length === 2) {
        const [from, to] = change.map(v => v.trim());
        if (from === to) continue;
        pairs.push({
          label: this.detailLabel('detailKeys', key),
          from: this.detailLabel('detailValues', from) || '—',
          value: this.detailLabel('detailValues', to) || '—',
        });
        continue;
      }
      pairs.push({ label: this.detailLabel('detailKeys', key), value: this.detailLabel('detailValues', value) || '—' });
    }

    // Every field was unchanged or already shown elsewhere.
    if (!pairs.length) return { ...empty, detailsText: '—' };

    return {
      detailPairs: pairs.slice(0, MAX_DETAILS),
      detailsMore: Math.max(0, pairs.length - MAX_DETAILS),
      // One detail per line (the tooltip style keeps the line breaks).
      detailsTooltip: pairs.map(p => `${p.label}: ${p.from ? `${p.from} → ` : ''}${p.value}`).join('\n'),
      detailsText: '',
    };
  }

  // Known keys/values get a translation; anything else is shown exactly as the backend sent it.
  private detailLabel(group: 'detailKeys' | 'detailValues', raw: string): string {
    const key = `d3.subscriptionLog.${group}.${raw}`;
    const translated = this.translate.instant(key);
    return translated === key ? raw : translated;
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
    // The API may send the action as an enum name or already translated, so both are matched.
    const a = (action ?? '').toLowerCase();
    const has = (...words: string[]) => words.some(w => a.includes(w));
    if (has('renew', 'تجديد')) return 'renew';
    if (has('reject', 'cancel', 'deactiv', 'suspend', 'expire', 'رفض', 'إلغاء', 'تعطيل', 'إيقاف', 'انتهاء')) return 'cancel';
    if (has('approv', 'activ', 'creat', 'request', 'subscrib', 'موافقة', 'تفعيل', 'إنشاء', 'تقديم')) return 'add';
    return 'neutral';
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  onServiceFilterChange(value: number | 'all'): void {
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
