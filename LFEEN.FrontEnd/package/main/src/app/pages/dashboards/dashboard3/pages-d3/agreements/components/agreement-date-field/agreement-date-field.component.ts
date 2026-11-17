import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { DateAdapter, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { appLocale } from 'src/app/utils/locale-format.util';
import {
  RiyadhDay,
  dayToPickerDate,
  formatPickedDay,
  pickerDateToDay,
  tomorrowInRiyadh,
} from '../../utils/agreement-date.util';

/**
 * Expiry date field: a read-only box showing the picked Riyadh day plus an inline
 * calendar. Days before tomorrow (Riyadh) can't be picked.
 */
@Component({
  selector: 'app-agreement-date-field',
  standalone: true,
  imports: [CommonModule, MatDatepickerModule, TranslateModule, TablerIconsModule],
  providers: [provideNativeDateAdapter()],
  templateUrl: './agreement-date-field.component.html',
  styleUrl: './agreement-date-field.component.scss',
})
export class AgreementDateFieldComponent implements OnInit {
  private translate = inject(TranslateService);
  private adapter = inject(DateAdapter<Date>);

  @Input() value: RiyadhDay | null = null;
  @Input() disabled = false;
  @Input() invalid = false;
  /** Keep the calendar open (expiry dialog) instead of toggling it from the box. */
  @Input() alwaysOpen = false;
  @Input() placeholderKey = 'd3.agreements.date.placeholder';
  @Input() inputId = '';
  @Output() valueChange = new EventEmitter<RiyadhDay | null>();

  open = false;
  readonly minDate = dayToPickerDate(tomorrowInRiyadh())!;

  get lang(): string {
    return this.translate.currentLang === 'en' ? 'en' : 'ar';
  }

  get label(): string {
    return formatPickedDay(this.value, this.lang);
  }

  get selected(): Date | null {
    return dayToPickerDate(this.value);
  }

  /** Open the calendar on the picked month, or on the first allowed one. */
  get startAt(): Date {
    return this.selected ?? this.minDate;
  }

  ngOnInit(): void {
    this.adapter.setLocale(appLocale(this.lang));
  }

  toggle(): void {
    if (this.disabled || this.alwaysOpen) return;
    this.open = !this.open;
  }

  pick(date: Date | null): void {
    this.valueChange.emit(pickerDateToDay(date));
    if (!this.alwaysOpen) this.open = false;
  }

  clear(event: Event): void {
    event.stopPropagation();
    this.valueChange.emit(null);
  }
}
