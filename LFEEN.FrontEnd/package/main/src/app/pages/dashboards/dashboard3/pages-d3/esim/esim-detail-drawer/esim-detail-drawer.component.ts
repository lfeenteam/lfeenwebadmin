import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { parseApiUtc } from 'src/app/utils/date-format.util';
import {
  EsimAdminActionKey, EsimDetail, EsimTimelineKey, esimAdminActionKey, esimDurationKey, esimIsUnlimited, esimStatusKey,
} from '../interfaces/esim.model';
import { appLocale } from 'src/app/utils/locale-format.util';

interface JourneyStep {
  titleKey: string;
  descKey: string;
  date: string | null;
  done: boolean;
}

/** One row of the support-actions log, ready to render. */
interface AdminLogEntry {
  /** null = an actionType we don't know yet; `label` then holds the raw value. */
  key: EsimAdminActionKey | null;
  label: string;
  icon: string;
  adminName: string;
  reason: string | null;
  amount: number | null;
  date: string | null;
}

const ADMIN_ACTION_ICONS: Record<EsimAdminActionKey, string> = {
  refund: 'receipt-refund',
  suspend: 'player-pause',
  unsuspend: 'player-play',
  revoke: 'trash',
  sms: 'message',
};

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
  /** Esim.ManageState — shows the order refund button. */
  @Input() canRefund = false;
  /** Another action on a SIM is in flight. */
  @Input() busy = false;
  @Output() refund = new EventEmitter<void>();
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

  /** Translation segment under d3.esim.payment.* — also the pill's `pay-*` class. */
  get paymentStatusKey(): string {
    switch (this.sim?.paymentStatus) {
      case 'Paid':              return 'paid';
      case 'Authorized':        return 'authorized';
      case 'PartiallyRefunded': return 'partiallyRefunded';
      case 'Refunded':          return 'refunded';
      case 'Failed':            return 'failed';
      case 'Cancelled':         return 'cancelled';
      case 'CheckoutCreated':   return 'checkoutCreated';
      default:                  return 'other';
    }
  }

  get paymentStatusLabel(): string {
    const key = this.paymentStatusKey;
    return key === 'other' ? (this.sim?.paymentStatus ?? '') : this.translate.instant(`d3.esim.payment.${key}`);
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

  /** Support actions (refund / suspend / revoke / SMS…), newest first as the API sends them. */
  get adminLog(): AdminLogEntry[] {
    return (this.sim?.adminActions ?? []).map(a => {
      const key = esimAdminActionKey(a.actionType);
      return {
        key,
        label: key ? this.translate.instant(`d3.esim.adminLog.types.${key}`) : (a.actionType || '-'),
        icon: key ? ADMIN_ACTION_ICONS[key] : 'history',
        adminName: a.adminName?.trim() || a.adminUserId || this.translate.instant('d3.esim.adminLog.unknownAdmin'),
        reason: a.reason?.trim() || null,
        amount: a.amount ?? null,
        date: this.fmtDateTime(a.createdAtUtc),
      };
    });
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  fmtAmount(value: number): string {
    return value.toLocaleString(appLocale(this.currentLang), {
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

  private fmtDateTime(value: string | null): string | null {
    const date = parseApiUtc(value);
    const en = this.currentLang === 'en';
    return date ? format(date, en ? 'd MMM yyyy, HH:mm' : 'd MMM yyyy، HH:mm', { locale: en ? enUS : ar }) : null;
  }
}
