import { CommonModule } from '@angular/common';
import {
  Component,
  Input,
  OnChanges,
  Output,
  EventEmitter,
  SimpleChanges,
  inject,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

type Period = 'AM' | 'PM';

@Component({
  selector: 'app-time-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './time-select.component.html',
  styleUrl: './time-select.component.scss',
})
export class TimeSelectComponent implements OnChanges {
  /** 24-hour "HH:mm", matching the backend's storage format. */
  @Input() value: string | null = null;
  /** Emits 24-hour "HH:mm", regardless of the 12-hour UI shown to the user. */
  @Output() timeSelected = new EventEmitter<string>();

  private translate = inject(TranslateService);

  hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  minutes = Array.from({ length: 12 }, (_, i) =>
    String(i * 5).padStart(2, '0'),
  );
  selectedHour = '12';
  selectedMinute = '00';
  selectedPeriod: Period = 'AM';

  get isRtl(): boolean {
    return this.translate.currentLang !== 'en';
  }

  get amLabel(): string {
    return this.isRtl ? 'صباحًا' : 'AM';
  }

  get pmLabel(): string {
    return this.isRtl ? 'مساءً' : 'PM';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value']) {
      const [hStr, mStr] = (this.value || '00:00').split(':');
      const h24 = Number(hStr) || 0;
      this.selectedPeriod = h24 >= 12 ? 'PM' : 'AM';
      let h12 = h24 % 12;
      if (h12 === 0) h12 = 12;
      this.selectedHour = String(h12).padStart(2, '0');
      this.selectedMinute = mStr || '00';
    }
  }

  pickHour(h: string): void {
    this.selectedHour = h;
    this.emit();
  }

  pickMinute(m: string): void {
    this.selectedMinute = m;
    this.emit();
  }

  pickPeriod(p: Period): void {
    this.selectedPeriod = p;
    this.emit();
  }

  private emit(): void {
    let h24 = Number(this.selectedHour) % 12;
    if (this.selectedPeriod === 'PM') h24 += 12;
    this.timeSelected.emit(
      `${String(h24).padStart(2, '0')}:${this.selectedMinute}`,
    );
  }
}
