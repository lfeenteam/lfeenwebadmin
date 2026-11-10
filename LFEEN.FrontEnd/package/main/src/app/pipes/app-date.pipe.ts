import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { APP_DATE_PRESETS, formatAppDate } from '../utils/locale-format.util';

/**
 * Replaces Angular's `date` pipe in the admin: that one formats with LOCALE_ID (en-US),
 * so Arabic pages showed "Jan 1, 1976". Impure so it follows a language switch.
 */
@Pipe({ name: 'appDate', standalone: true, pure: false })
export class AppDatePipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(value: string | number | Date | null | undefined, preset: 'mediumDate' | 'medium' = 'mediumDate'): string {
    return formatAppDate(value, this.translate.currentLang, APP_DATE_PRESETS[preset]);
  }
}
