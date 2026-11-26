import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { formatAppNumber } from 'src/app/utils/locale-format.util';
import { translatePlural } from 'src/app/pipes/app-plural.pipe';
import { AgreementType, AgreementVersion, isExpiredPublished } from '../interfaces/agreement.model';
import { formatRiyadhDate } from '../utils/agreement-date.util';

/** Display text shared by the list, the version page and the dialogs. */
@Injectable({ providedIn: 'root' })
export class AgreementLabelsService {
  private translate = inject(TranslateService);

  get lang(): 'ar' | 'en' {
    return this.translate.currentLang === 'en' ? 'en' : 'ar';
  }

  get dir(): 'rtl' | 'ltr' {
    return this.lang === 'en' ? 'ltr' : 'rtl';
  }

  typeLabel(type: AgreementType): string {
    return this.translate.instant(`d3.agreements.types.${type}`);
  }

  /** «النسخة 3», or «مسودة» for a draft (version 0). */
  versionLabel(v: AgreementVersion): string {
    return v.status === 'Draft' || !v.version
      ? this.translate.instant('d3.agreements.status.Draft')
      : this.translate.instant('d3.agreements.versionN', { n: this.num(v.version) });
  }

  title(v: AgreementVersion): string {
    const primary = this.lang === 'en' ? v.titleEn : v.titleAr;
    const fallback = this.lang === 'en' ? v.titleAr : v.titleEn;
    return primary?.trim() || fallback?.trim() || this.typeLabel(v.type);
  }

  /** The other language's title, shown under the main one. */
  subtitle(v: AgreementVersion): string {
    return (this.lang === 'en' ? v.titleAr : v.titleEn)?.trim() || '';
  }

  /**
   * Published but past its expiry date shows «منتهية الصلاحية». Our own translation wins:
   * the server's statusName arrives in English ("Ended") even with Accept-Language: ar.
   * statusName is only the fallback for a status we have no key for.
   */
  statusLabel(v: AgreementVersion): string {
    if (isExpiredPublished(v)) return this.translate.instant('d3.agreements.status.Expired');
    const key = `d3.agreements.status.${v.status}`;
    const own = this.translate.instant(key);
    return own && own !== key ? own : v.statusName?.trim() || v.status;
  }

  statusClass(v: AgreementVersion): string {
    if (isExpiredPublished(v)) return 'is-expired';
    return v.status === 'Draft' ? 'is-draft' : v.status === 'Published' ? 'is-published' : 'is-ended';
  }

  date(iso: string | null | undefined, withTime = false): string {
    return formatRiyadhDate(iso, this.lang, withTime) || '—';
  }

  num(value: number | null | undefined): string {
    return formatAppNumber(value ?? 0, this.lang);
  }

  signers(count: number | null | undefined): string {
    return translatePlural(this.translate, 'd3.agreements.signersN', count);
  }

  /**
   * «بند واحد» / «بندان» / «٣ بنود» / «١١ بندًا» / «١٠٠ بند»: Arabic picks the noun
   * form by the number (3–10 plural, 11–99 singular accusative, the rest singular).
   * English only splits one / many.
   */
  clauses(count: number | null | undefined): string {
    const n = Math.max(0, count ?? 0);
    const r = n % 100;
    const form = n === 0 ? 'zero'
      : n === 1 ? 'one'
      : n === 2 ? 'two'
      : r >= 3 && r <= 10 ? 'few'
      : r >= 11 ? 'many'
      : 'other';
    return this.translate.instant(`d3.agreements.clauseCount.${form}`, { n: this.num(n) });
  }

  /**
   * Who published / ended a version, as shown under its date: «بواسطة أحمد», or
   * «تلقائيًا من النظام» for system notes the server stores in the same field
   * (e.g. "migration: seeded text, replaced by …" on the seeded Host v1–v5).
   * Empty when nobody is recorded, so the caller shows the date alone.
   */
  actor(name: string | null | undefined): string {
    const value = name?.trim();
    if (!value) return '';
    if (SYSTEM_ACTOR.test(value)) return this.translate.instant('d3.agreements.bySystem');
    return this.translate.instant('d3.agreements.byName', { name: value });
  }
}

/** Server-written notes in publishedBy / endedBy, not an admin's name. */
const SYSTEM_ACTOR = /^(migration|system|seed)\b/i;
