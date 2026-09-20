import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { CoreService } from 'src/app/services/core.service';
import { extractApiErrorMessage } from '../../utils/api-error.util';
import {
  PlatformOfferDetail,
  PlatformOfferStatistics,
} from './interfaces/platform-offer.model';
import { PlatformOffersService } from './services/platform-offers.service';
@Component({
  selector: 'app-platform-offer-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, TablerIconsModule],
  templateUrl: './platform-offer-detail.component.html',
  styleUrl: './platform-offers.component.scss',
})
export class PlatformOfferDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(PlatformOffersService);
  private core = inject(CoreService);
  private tr = inject(TranslateService);
  dir = computed(() => this.core.getOptionsSignal()().dir);
  id = 0;
  offer = signal<PlatformOfferDetail | null>(null);
  stats = signal<PlatformOfferStatistics | null>(null);
  loading = signal(true);
  error = signal('');
  tab = signal('overview');
  ngOnInit() {
    this.id = +this.route.snapshot.paramMap.get('id')!;
    this.load();
  }
  load() {
    this.loading.set(true);
    this.service.get(this.id).subscribe({
      next: (o) => {
        this.offer.set(o);
        this.loading.set(false);
        this.service
          .stats(this.id)
          .subscribe({ next: (s) => this.stats.set(s) });
      },
      error: (e) => {
        this.error.set(
          extractApiErrorMessage(
            e,
            this.tr.instant('d3.platformOffers.errors.detail'),
          ),
        );
        this.loading.set(false);
      },
    });
  }
  status(o: PlatformOfferDetail) {
    if (o.isExpired) return 'expired';
    if (!o.isActive) return 'inactive';
    return o.statusEn?.trim().toLowerCase() === 'scheduled'
      ? 'scheduled'
      : 'active';
  }
  lang() {
    return this.router.url.split('/')[1] || 'ar';
  }
  editLink() {
    return ['/', this.lang(), 'd3', 'platform-offers', this.id, 'edit'];
  }
  formatDateTime(value?: string | null): string { return this.formatDate(value, true); }
  formatMediumDate(value?: string | null): string { return this.formatDate(value, false); }
  enumLabel(value: string): string {
    return this.tr.instant(`d3.platformOffers.enums.${value}`);
  }
  private formatDate(value: string | null | undefined, includeTime: boolean): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const options: Intl.DateTimeFormatOptions = includeTime
      ? { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { day: 'numeric', month: 'short', year: 'numeric' };
    return new Intl.DateTimeFormat(this.dir() === 'rtl' ? 'ar-EG' : 'en-US', options).format(date);
  }
}
