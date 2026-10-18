import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { DashboardService } from '../../../pages/dashboards/dashboard3/services/dashboard.service';
import { DashboardFilters } from '../../../pages/dashboards/dashboard3/pages-d3/ceo-page/interfaces/dashboard.model';
// Reusing the same calendar used by the bookings check-in/check-out filter:
// it's already fully localized (Arabic month/weekday names via Intl, RTL
// chevrons) instead of Angular Material's English-only native date adapter.
import { SingleDateCalendarComponent } from '../../../pages/dashboards/dashboard3/pages-d3/all-bookings/components/single-date-calendar/single-date-calendar.component';

// Saudi Arabia has no DST, so Riyadh is a fixed +03:00 offset year-round —
// no time-zone library needed to reason about it.
const RIYADH_TZ = 'Asia/Riyadh';
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;

type PresetKey = 'thisMonth' | 'lastMonth' | 'last90' | 'custom';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Builds "YYYY-MM-DDT00:00:00+03:00" straight from calendar Y/M/D components —
// never through Date#toISOString(), which re-expresses the instant in the
// browser's own offset and can silently shift a Riyadh midnight to the wrong day.
function isoAtRiyadhMidnight(year: number, month0: number, day: number): string {
  return `${year}-${pad(month0 + 1)}-${pad(day)}T00:00:00+03:00`;
}

// "Today" in Riyadh, independent of the browser's own time zone: shift the
// current instant by the fixed +03:00 offset and read it back with UTC
// getters, which yields Riyadh's wall-clock Y/M/D.
function riyadhNow(): { year: number; month0: number; day: number } {
  const shifted = new Date(Date.now() + RIYADH_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month0: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

// SingleDateCalendarComponent emits/accepts plain "YYYY-MM-DD" strings that
// already carry the exact calendar day the admin clicked — parse them
// directly instead of going through a Date + local/UTC getters round-trip.
function parsePlainDate(plain: string): { year: number; month0: number; day: number } {
  const [year, month, day] = plain.split('-').map(Number);
  return { year, month0: month - 1, day };
}

function isoFromPlainDate(plain: string): string {
  const { year, month0, day } = parsePlainDate(plain);
  return isoAtRiyadhMidnight(year, month0, day);
}

// `to` is exclusive: the calendar day right after the picked end date.
function nextDayIso(plain: string): string {
  const { year, month0, day } = parsePlainDate(plain);
  const next = new Date(year, month0, day + 1); // local Date normalizes month/year overflow
  return isoAtRiyadhMidnight(next.getFullYear(), next.getMonth(), next.getDate());
}

interface PeriodOption {
  key: PresetKey;
  labelKey: string;
}

const PRESETS: PeriodOption[] = [
  { key: 'thisMonth', labelKey: 'd3.filters.thisMonth' },
  { key: 'lastMonth', labelKey: 'd3.filters.lastMonth' },
  { key: 'last90', labelKey: 'd3.filters.last90Days' },
];

@Component({
  selector: 'app-dashboard3-period-filter',
  standalone: true,
  imports: [CommonModule, MatMenuModule, SingleDateCalendarComponent, TablerIconsModule, TranslateModule],
  templateUrl: './period-filter.component.html',
  styleUrl: './period-filter.component.scss',
})
export class PeriodFilterComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dashboard = inject(DashboardService);
  private readonly translate = inject(TranslateService);
  private readonly toastr = inject(ToastrService);

  readonly presets = PRESETS;
  readonly activePreset = signal<PresetKey>('thisMonth');
  readonly rangeTooLong = signal(false);
  readonly lang = signal(this.translate.currentLang || 'ar');

  // Plain "YYYY-MM-DD" strings, same shape SingleDateCalendarComponent works with.
  readonly customFrom = signal<string | null>(null);
  readonly customTo = signal<string | null>(null);

  // Only the two most recently *applied* dates, kept for the "current period" label —
  // display-only, not the source of truth (that's dashboard.filters).
  private appliedLabelDates = signal<{ from: string; to: string } | null>(null);

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.lang.set(event.lang));
  }

  selectPreset(key: PresetKey): void {
    this.rangeTooLong.set(false);
    this.customFrom.set(null);
    this.customTo.set(null);

    if (key === 'thisMonth') {
      // Omit both dates entirely — the backend picks the current Riyadh month itself.
      this.apply(key, undefined);
      return;
    }

    const { year, month0, day } = riyadhNow();

    if (key === 'lastMonth') {
      const from = isoAtRiyadhMidnight(year, month0 - 1, 1);
      const to = isoAtRiyadhMidnight(year, month0, 1); // exclusive: start of this month
      this.apply(key, { from, to });
      return;
    }

    // last90: today inclusive, going back 90 days; `to` is tomorrow (exclusive).
    const from = isoAtRiyadhMidnight(year, month0, day - 89);
    const to = isoAtRiyadhMidnight(year, month0, day + 1);
    this.apply(key, { from, to });
  }

  onFromSelect(plain: string): void {
    const to = this.customTo();
    if (to && to < plain) {
      // Same UX as the bookings check-in/check-out filter: an end date that's
      // no longer valid against the new start gets cleared, not silently kept.
      this.customTo.set(null);
      this.toastr.info(this.translate.instant('d3.filters.toClearedHint'));
    }
    this.customFrom.set(plain);
    this.activePreset.set('custom');
    this.tryApplyCustomRange();
  }

  onToSelect(plain: string): void {
    const from = this.customFrom();
    if (from && plain < from) {
      this.toastr.error(this.translate.instant('d3.filters.rangeOrderError'));
      return;
    }
    this.customTo.set(plain);
    this.activePreset.set('custom');
    this.tryApplyCustomRange();
  }

  // Debounced until both boundaries of the custom range are valid: nothing is
  // applied from a single date pick, only once "from" AND "to" are both set.
  private tryApplyCustomRange(): void {
    const from = this.customFrom();
    const to = this.customTo();
    if (!from || !to) return;

    const fromIso = isoFromPlainDate(from);
    const toIso = nextDayIso(to);

    const { year: y1, month0: m1, day: d1 } = parsePlainDate(from);
    const { year: y2, month0: m2, day: d2 } = parsePlainDate(to);
    const days = Math.round((Date.UTC(y2, m2, d2 + 1) - Date.UTC(y1, m1, d1)) / 86400000);

    if (days > MAX_RANGE_DAYS) {
      this.rangeTooLong.set(true);
      return;
    }

    this.rangeTooLong.set(false);
    this.apply('custom', { from: fromIso, to: toIso });
  }

  private apply(preset: PresetKey, range: { from: string; to: string } | undefined): void {
    this.activePreset.set(preset);
    this.appliedLabelDates.set(range ?? null);
    const filters: DashboardFilters = range ? { ...range, timeZone: RIYADH_TZ } : {};
    this.dashboard.filters.set(filters);
  }

  // Display-only label for the currently applied period, formatted the same
  // way dates read elsewhere in this app (see settlements.component.ts).
  //
  // Parses the Y/M/D straight out of the ISO string's literal text instead of
  // going through `new Date(iso)` + local getters: that route re-reads the
  // instant in the *browser's* time zone, which can silently roll a Riyadh
  // "2026-09-01" back to "Aug 31" for an admin viewing from another region.
  currentRangeLabel(): string | null {
    const range = this.appliedLabelDates();
    if (!range) return null;
    const from = this.dateFromIso(range.from);
    const toExclusive = this.dateFromIso(range.to);
    // `to` is exclusive; show the last included day, not the boundary itself.
    const to = new Date(toExclusive.getFullYear(), toExclusive.getMonth(), toExclusive.getDate() - 1);
    return `${this.formatDate(from)} – ${this.formatDate(to)}`;
  }

  // Same friendly "1 Sep 2026" formatting for the date pills as the summary
  // label uses, instead of a raw "2026-09-01" — a plain ISO string reads as a
  // technical value and doesn't match the rest of the bar.
  formatPlainDate(plain: string): string {
    return this.formatDate(this.dateFromIso(plain));
  }

  private formatDate(date: Date): string {
    const locale = this.lang() === 'en' ? enUS : ar;
    return format(date, 'd MMM yyyy', { locale });
  }

  private dateFromIso(iso: string): Date {
    const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  clearCustomRange(): void {
    this.selectPreset('thisMonth');
  }
}
