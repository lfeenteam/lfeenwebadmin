import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import {
  EMPTY,
  Subject,
  catchError,
  distinctUntilChanged,
  map,
  merge,
  switchMap,
  tap,
} from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { CoreService } from 'src/app/services/core.service';
import { extractApiErrorMessage } from '../../utils/api-error.util';
import {
  PlatformOfferDetail,
  PlatformOfferStatistics,
  normalizeDisplayChannel,
} from './interfaces/platform-offer.model';
import { PlatformOffersService } from './services/platform-offers.service';
import { happyHourWindow } from './platform-offer.validators';
import { appLocale } from 'src/app/utils/locale-format.util';
@Component({
  selector: 'app-platform-offer-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, TablerIconsModule],
  templateUrl: './platform-offer-detail.component.html',
  styleUrl: './platform-offers.component.scss',
})
export class PlatformOfferDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(PlatformOffersService);
  private core = inject(CoreService);
  private tr = inject(TranslateService);
  dir = computed(() => this.core.getOptionsSignal()().dir);
  id = 0;
  offer = signal<PlatformOfferDetail | null>(null);
  stats = signal<PlatformOfferStatistics | null>(null);
  loading = signal(true);
  error = signal('');
  tab = signal('overview');
  private destroyRef = inject(DestroyRef);
  private reload$ = new Subject<void>();
  /**
   * Follows the id in the URL: going from /platform-offers/2 to /50 (address bar,
   * back/forward) reuses this component, so the offer is reloaded on every id change.
   */
  ngOnInit() {
    const id$ = this.route.paramMap.pipe(
      map((p) => Number(p.get('id'))),
      distinctUntilChanged(),
      tap((id) => {
        this.id = id;
        this.offer.set(null);
        this.stats.set(null);
        this.tab.set('overview');
      }),
    );
    merge(id$, this.reload$.pipe(map(() => this.id)))
      .pipe(
        // A newer id cancels the requests of the previous one, so a late answer
        // for the old offer never lands on the new one.
        switchMap((id) => {
          this.loading.set(true);
          this.error.set('');
          return this.service.get(id).pipe(
            tap({
              next: (o) => {
                this.offer.set(o);
                this.loading.set(false);
              },
              error: (e) => {
                this.error.set(
                  extractApiErrorMessage(
                    e,
                    this.tr.instant('d3.platformOffers.errors.detail'),
                  ),
                );
                this.loading.set(false);
              },
            }),
            switchMap(() =>
              this.service.stats(id).pipe(catchError(() => EMPTY)),
            ),
            catchError(() => EMPTY),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((s) => this.stats.set(s));
  }
  load() {
    this.reload$.next();
  }
  status(o: PlatformOfferDetail) {
    if (o.isExpired) return 'expired';
    if (!o.isActive) return 'inactive';
    return o.statusEn?.trim().toLowerCase() === 'scheduled'
      ? 'scheduled'
      : 'active';
  }
  lang() {
    return this.router.url.split('/')[1] || 'ar';
  }
  editLink() {
    return ['/', this.lang(), 'd3', 'platform-offers', this.id, 'edit'];
  }
  formatDateTime(value?: string | null): string { return this.formatDate(value, true); }
  formatMediumDate(value?: string | null): string { return this.formatDate(value, false); }
  /** Falls back to "—" when the API sends a value we have no label for (e.g. a bare number). */
  enumLabel(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '—';
    const key = `d3.platformOffers.enums.${value}`;
    const label = this.tr.instant(key);
    return label === key ? '—' : label;
  }
  /** Accepts both the enum name and the bare number older API builds send ("1" → All). */
  channelLabel(value: unknown): string {
    return this.enumLabel(normalizeDisplayChannel(value));
  }
  /** "Available from 22:00 to 02:00 (next day)", or "—" with no happy hour. */
  happyHourLabel(o: PlatformOfferDetail): string {
    const w = happyHourWindow(o.happyHourStart, o.happyHourEnd);
    if (!w) return '—';
    return this.tr.instant(
      `d3.platformOffers.happyHour.summary${w.overnight ? 'NextDay' : ''}`,
      { start: w.start, end: w.end },
    );
  }
  private formatDate(value: string | null | undefined, includeTime: boolean): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const options: Intl.DateTimeFormatOptions = includeTime
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' };
    return new Intl.DateTimeFormat(appLocale(this.dir() === 'rtl' ? 'ar' : 'en'), options).format(date);
  }
}
