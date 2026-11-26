import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { appLocale, formatAppNumber } from '../utils/locale-format.util';

const rulesCache = new Map<string, Intl.PluralRules>();

function pluralRules(locale: string): Intl.PluralRules {
  let rules = rulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    rulesCache.set(locale, rules);
  }
  return rules;
}

/**
 * Translates `baseKey` in the plural form that fits `count`, for code that can't use the pipe
 * (services building dialog text, toasts…). See {@link AppPluralPipe} for the key shape.
 * `{{count}}` is the formatted number (thousands separators, the app's digits).
 */
export function translatePlural(
  translate: TranslateService,
  baseKey: string,
  count: number | null | undefined,
  params?: Record<string, unknown>
): string {
  const n = count ?? 0;
  const lang = translate.currentLang || translate.defaultLang || 'ar';
  const interpolate = { ...params, count: formatAppNumber(n, lang) };

  const candidates = [
    ...(n === 0 ? ['zero'] : []),
    pluralRules(appLocale(lang)).select(n),
    'other',
  ];
  for (const category of candidates) {
    const key = `${baseKey}.${category}`;
    const text = translate.instant(key, interpolate);
    if (text !== key) return text;
  }
  return `${baseKey}.other`;
}

/**
 * Picks the plural form of a translation by count, since ngx-translate has no ICU plural.
 * The base key is an object of CLDR categories (zero / one / two / few / many / other):
 * Arabic uses all of them (ليلة واحدة، ليلتان، ٣ ليالٍ، ١١ ليلة), English only one / other.
 * A missing category falls back to `other`; `zero` is also honoured for 0 in English.
 *
 *   {{ 'd3.bookings.detail.staySection.nights' | appPlural: count }}
 *   {{ 'd3.bookings.detail.financeTab.nightsBreakdown' | appPlural: count : { rate } }}
 *
 * `{{count}}` is always available to the translation. Impure so it follows a language switch.
 */
@Pipe({ name: 'appPlural', standalone: true, pure: false })
export class AppPluralPipe implements PipeTransform {
  private translate = inject(TranslateService);

  transform(baseKey: string, count: number | null | undefined, params?: Record<string, unknown>): string {
    return translatePlural(this.translate, baseKey, count, params);
  }
}
