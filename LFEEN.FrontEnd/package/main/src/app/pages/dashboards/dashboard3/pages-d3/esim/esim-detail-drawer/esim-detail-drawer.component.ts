import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import { EsimDetail, EsimTimelineKey, esimDurationKey, esimIsUnlimited, esimStatusKey } from '../interfaces/esim.model';

interface JourneyStep {
  titleKey: string;
  descKey: string;
  date: string | null;
  done: boolean;
}

@Component({
  selector: 'app-esim-detail-drawer',
  standalone: true,
  imports: [CommonModule, A11yModule, TablerIconsModule, TranslateModule],
  templateUrl: './esim-detail-drawer.component.html',
  styleUrl: './esim-detail-drawer.component.scss'
})
export class EsimDetailDrawerComponent implements OnChanges, OnDestroy {
  private translate = inject(TranslateService);

  @Input() sim: EsimDetail | null = null;
  @Output() closed = new EventEmitter<void>();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sim']) {
      document.body.style.overflow = this.sim ? 'hidden' : '';
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.sim) this.close();
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get initials(): string {
    const words = (this.sim?.userName ?? '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '-';
    const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
    return letters.toUpperCase();
  }

  /** Consumed share of the plan's data, 0–100 (pre-computed by the API). */
  get usagePercent(): number {
    return Math.min(100, Math.max(0, Math.round(this.sim?.usedPercent ?? 0)));
  }

  get durationKey(): string {
    return esimDurationKey(this.sim?.totalDuration ?? 0, this.sim?.durationUnit ?? '');
  }

  get statusKey(): string {
    return this.sim ? esimStatusKey(this.sim.statusBucket) : 'expired';
  }

  get isUnlimited(): boolean {
    return esimIsUnlimited(this.sim?.dataPlanLabel);
  }

  /** "8988240001928473" → "8988 2400 0192 8473". */
  get formattedIccid(): string {
    const iccid = (this.sim?.iccid ?? '').replace(/\s+/g, '');
    return iccid ? iccid.replace(/(.{4})(?=.)/g, '$1 ') : '-';
  }

  /** The design shows 3 steps, so the API's `installed` step is skipped. */
  get journey(): JourneyStep[] {
    const s = this.sim;
    if (!s) return [];
    const at = (key: EsimTimelineKey) => s.timeline?.find(t => t.key === key)?.atUtc ?? null;
    const activatedAt = at('activated') ?? s.activatedAtUtc;
    const expiresAt = at('expires') ?? s.expiresAtUtc;
    const activated = !!activatedAt;
    const expired = s.statusBucket === 'Expired';
    return [
      {
        titleKey: 'd3.esim.detail.journey.purchased',
        descKey: 'd3.esim.detail.journey.purchasedDesc',
        date: this.fmtDate(at('purchased') ?? s.createdAtUtc),
        done: true,
      },
      {
        titleKey: activated ? 'd3.esim.detail.journey.activated' : 'd3.esim.detail.journey.activation',
        descKey: activated ? 'd3.esim.detail.journey.activatedDesc' : 'd3.esim.detail.journey.activationDesc',
        date: this.fmtDate(activatedAt),
        done: activated,
      },
      {
        titleKey: 'd3.esim.detail.journey.expiry',
        descKey: expired ? 'd3.esim.detail.journey.expiredDesc' : 'd3.esim.detail.journey.expiryDesc',
        date: this.fmtDate(expiresAt),
        done: expired,
      },
    ];
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  fmtAmount(value: number): string {
    return value.toLocaleString(this.currentLang === 'en' ? 'en-US' : 'ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  close(): void {
    this.closed.emit();
  }

  private fmtDate(value: string | null): string | null {
    const date = parseApiUtc(value);
    return date ? format(date, 'd MMMM yyyy', { locale: this.currentLang === 'en' ? enUS : ar }) : null;
  }
}
