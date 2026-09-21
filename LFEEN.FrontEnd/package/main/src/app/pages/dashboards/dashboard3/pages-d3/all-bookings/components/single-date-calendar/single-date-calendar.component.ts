import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateService } from '@ngx-translate/core';

interface CalendarDay {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

@Component({
  selector: 'app-single-date-calendar',
  standalone: true,
  imports: [CommonModule, TablerIconsModule],
  templateUrl: './single-date-calendar.component.html',
  styleUrl: './single-date-calendar.component.scss'
})
export class SingleDateCalendarComponent implements OnChanges {
  @Input() value: string | null = null;
  @Output() dateSelected = new EventEmitter<string>();

  private translate = inject(TranslateService);

  viewMonth = this.startOfMonth(new Date());
  selected: Date | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      this.selected = this.value ? this.parseIsoDate(this.value) : null;
      this.viewMonth = this.startOfMonth(this.selected ?? new Date());
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

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(year, m, 1 - startOffset + i);
      return {
        date,
        inCurrentMonth: date.getMonth() === m,
        isToday: this.stripTime(date).getTime() === today.getTime(),
        isSelected: this.isSameDay(date, this.selected),
      };
    });
  }

  selectDay(day: CalendarDay): void {
    if (!day.inCurrentMonth) return;
    this.selected = day.date;
    this.dateSelected.emit(this.toIsoDate(day.date));
  }

  prevMonth(): void {
    this.viewMonth = new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth() - 1, 1);
  }

  nextMonth(): void {
    this.viewMonth = new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth() + 1, 1);
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
