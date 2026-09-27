import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateService } from '@ngx-translate/core';

interface CalendarDay {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  /** Before `minDate` — shown greyed out and not selectable. */
  isBlocked: boolean;
}

const YEARS_PER_PAGE = 12;

@Component({
  selector: 'app-single-date-calendar',
  standalone: true,
  imports: [CommonModule, TablerIconsModule],
  templateUrl: './single-date-calendar.component.html',
  styleUrl: './single-date-calendar.component.scss'
})
export class SingleDateCalendarComponent implements OnChanges {
  @Input() value: string | null = null;
  /** Optional 'YYYY-MM-DD' lower bound; earlier days, months and years can't be picked. */
  @Input() minDate: string | null = null;
  @Output() dateSelected = new EventEmitter<string>();

  private translate = inject(TranslateService);

  viewMonth = this.startOfMonth(new Date());
  selected: Date | null = null;

  /** 'days' is the normal calendar grid. Clicking the header drills up to
   *  'months' (pick a month within a year) and then 'years' (pick a year
   *  itself), so a far-off date doesn't need clicking the month arrow dozens
   *  of times. */
  view: 'days' | 'months' | 'years' = 'days';
  private yearRangeStart = this.startOfYearPage(this.viewMonth.getFullYear());

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.selected = this.value ? this.parseIsoDate(this.value) : null;
      this.viewMonth = this.startOfMonth(this.selected ?? new Date());
      this.view = 'days';
      this.yearRangeStart = this.startOfYearPage(this.viewMonth.getFullYear());
    }
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  private get locale(): string {
    return this.currentDir === 'rtl' ? 'ar-SA' : 'en-US';
  }

  get weekdayLabels(): string[] {
    const fmt = new Intl.DateTimeFormat(this.locale, { weekday: 'short' });
    // 2023-01-01 is a Sunday — used only as a stable anchor to read localized weekday names.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2023, 0, 1 + i)));
  }

  get monthLabel(): string {
    return new Intl.DateTimeFormat(this.locale, { month: 'long', year: 'numeric' }).format(this.viewMonth);
  }

  dayNumberLabel(date: Date): string {
    return new Intl.DateTimeFormat(this.locale, { day: 'numeric' }).format(date);
  }

  get days(): CalendarDay[] {
    const year = this.viewMonth.getFullYear();
    const m = this.viewMonth.getMonth();
    const startOffset = new Date(year, m, 1).getDay();
    const today = this.stripTime(new Date());
    const min = this.min;

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(year, m, 1 - startOffset + i);
      return {
        date,
        inCurrentMonth: date.getMonth() === m,
        isToday: this.stripTime(date).getTime() === today.getTime(),
        isSelected: this.isSameDay(date, this.selected),
        isBlocked: !!min && date < min,
      };
    });
  }

  private get min(): Date | null {
    return this.minDate ? this.parseIsoDate(this.minDate) : null;
  }

  /** A whole month is blocked only when its last day is still before the minimum. */
  isMonthBlocked(index: number): boolean {
    const min = this.min;
    return !!min && new Date(this.viewMonth.getFullYear(), index + 1, 0) < min;
  }

  isYearBlocked(year: number): boolean {
    const min = this.min;
    return !!min && year < min.getFullYear();
  }

  selectDay(day: CalendarDay): void {
    if (!day.inCurrentMonth || day.isBlocked) return;
    this.selected = day.date;
    this.dateSelected.emit(this.toIsoDate(day.date));
  }

  prevMonth(): void {
    this.viewMonth = new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth() - 1, 1);
  }

  nextMonth(): void {
    this.viewMonth = new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth() + 1, 1);
  }

  // Drills up one level: days -> months (pick a month in the current year) ->
  // years (pick the year itself). The header text is the only affordance —
  // there's no separate caret icon to click.
  drillUp(): void {
    if (this.view === 'days') {
      this.view = 'months';
    } else if (this.view === 'months') {
      this.yearRangeStart = this.startOfYearPage(this.viewMonth.getFullYear());
      this.view = 'years';
    }
  }

  headerNavPrev(): void {
    if (this.view === 'years') this.prevYearPage();
    else if (this.view === 'months') this.shiftYear(-1);
    else this.prevMonth();
  }

  headerNavNext(): void {
    if (this.view === 'years') this.nextYearPage();
    else if (this.view === 'months') this.shiftYear(1);
    else this.nextMonth();
  }

  get headerLabel(): string {
    if (this.view === 'years') return this.yearRangeLabel;
    if (this.view === 'months') return this.yearLabel(this.viewMonth.getFullYear());
    return this.monthLabel;
  }

  get monthOptions(): { index: number; label: string }[] {
    return Array.from({ length: 12 }, (_, i) => ({
      index: i,
      label: new Intl.DateTimeFormat(this.locale, { month: 'short' }).format(new Date(2023, i, 1)),
    }));
  }

  isSelectedMonth(index: number): boolean {
    return index === this.viewMonth.getMonth();
  }

  selectMonth(index: number): void {
    if (this.isMonthBlocked(index)) return;
    this.viewMonth = new Date(this.viewMonth.getFullYear(), index, 1);
    this.view = 'days';
  }

  get yearOptions(): number[] {
    return Array.from({ length: YEARS_PER_PAGE }, (_, i) => this.yearRangeStart + i);
  }

  get yearRangeLabel(): string {
    const fmt = new Intl.NumberFormat(this.locale, { useGrouping: false });
    return `${fmt.format(this.yearRangeStart)} – ${fmt.format(this.yearRangeStart + YEARS_PER_PAGE - 1)}`;
  }

  yearLabel(year: number): string {
    return new Intl.NumberFormat(this.locale, { useGrouping: false }).format(year);
  }

  isSelectedYear(year: number): boolean {
    return year === this.viewMonth.getFullYear();
  }

  private prevYearPage(): void {
    this.yearRangeStart -= YEARS_PER_PAGE;
  }

  private nextYearPage(): void {
    this.yearRangeStart += YEARS_PER_PAGE;
  }

  private shiftYear(delta: number): void {
    this.viewMonth = new Date(this.viewMonth.getFullYear() + delta, this.viewMonth.getMonth(), 1);
  }

  selectYear(year: number): void {
    if (this.isYearBlocked(year)) return;
    this.viewMonth = new Date(year, this.viewMonth.getMonth(), 1);
    this.view = 'months';
  }

  private startOfYearPage(year: number): number {
    return year - (year % YEARS_PER_PAGE);
  }

  private parseIsoDate(value: string): Date {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private stripTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private isSameDay(a: Date | null, b: Date | null): boolean {
    return !!a && !!b && this.stripTime(a).getTime() === this.stripTime(b).getTime();
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }
}
