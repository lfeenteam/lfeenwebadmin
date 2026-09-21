import { Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { UnitsService } from '../../../../../services/units.service';
import { UnitServicesServiceItem } from '../../../../../interfaces/unit-card.model';
import { PageBreadcrumbTrailService } from '../../../../../services/page-breadcrumb-trail.service';
import { ReviewEmptyStateComponent } from 'src/app/components/dashboard3/review-empty-state/review-empty-state.component';

interface ServiceItem {
  id: string;
  title: string;
  icon: string;
  isFree: boolean;
  cost: number | null;
}

interface ServiceGroup {
  id: string;
  title: string;
  items: ServiceItem[];
}

@Component({
  selector: 'app-unit-services-review',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, MaterialModule, ReviewEmptyStateComponent],
  templateUrl: './unit-services-review.component.html',
  styleUrl: './unit-services-review.component.scss'
})
export class UnitServicesReviewComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageBreadcrumbTrail = inject(PageBreadcrumbTrailService);

  buildingId = '';
  unitId = '';
  currentLang = 'ar';
  isLoading = false;
  serviceGroups: ServiceGroup[] = [];

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get hasRealServicesData(): boolean {
    return this.serviceGroups.length > 0;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unitsService: UnitsService,
    private translate: TranslateService
  ) {
    this.currentLang = this.translate.currentLang || 'ar';
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLang = event.lang;
        // displayName is localized by the API, so remapping the previous
        // response keeps names in the old language — fetch it again instead
        // of requiring a page refresh.
        if (this.unitId) this.loadServices();
      });
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId = this.route.snapshot.paramMap.get('unitId') ?? '';

    if (!this.unitId) return;
    this.loadServices();
    this.unitsService.getUnitBasicData(this.unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        const lang = this.translate.currentLang || 'ar';
        this.pageBreadcrumbTrail.set([
          { label: data.title ?? '', translate: false, route: ['/', lang, 'd3', 'unit-review', this.buildingId, this.unitId] }
        ]);
      });
  }

  private loadServices(): void {
    this.isLoading = true;
    this.unitsService.getUnitServices(this.unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.serviceGroups = data.groups.map(g => ({
            id: g.groupKey,
            title: g.groupName,
            items: g.services.map(s => this.mapServiceItem(s)),
          }));
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; }
      });
  }

  ngOnDestroy(): void {
    this.pageBreadcrumbTrail.clear();
  }

  priceDisplay(item: ServiceItem): string {
    if (item.isFree) return this.translate.instant('d3.unitReview.servicesView.badges.free');
    if (item.cost != null) return String(item.cost);
    return '—';
  }

  showCurrency(item: ServiceItem): boolean {
    return !item.isFree && item.cost != null;
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  private mapServiceItem(service: UnitServicesServiceItem): ServiceItem {
    return {
      id: service.serviceExternalId,
      title: service.displayName,
      icon: this.getServiceIcon(service.displayName),
      isFree: service.isFree,
      cost: service.cost,
    };
  }

  private normalizeIconSearchValue(value: string): string {
    return value
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ً-ْ]/g, '')
      .trim();
  }

  private getServiceIcon(displayName: string): string {
    const name = this.normalizeIconSearchValue(displayName ?? '');
    const items: { icon: string; keywords: string[] }[] = [
      { icon: 'sparkles', keywords: ['cleaning', 'clean', 'نظافة', 'نظافه', 'تنظيف', 'مناشف'] },
      { icon: 'user-circle', keywords: ['concierge', 'كونسيرج', 'استقبال', 'بواب'] },
      { icon: 'coffee', keywords: ['breakfast', 'فطار', 'افطار', 'إفطار'] },
      { icon: 'soup', keywords: ['lunch', 'dinner', 'meal', 'غداء', 'عشاء', 'وجبة', 'وجبه', 'طعام'] },
      { icon: 'wifi', keywords: ['wifi', 'wi-fi', 'internet', 'واي فاي', 'انترنت', 'إنترنت'] },
      { icon: 'bus', keywords: ['transport', 'shuttle', 'نقل', 'مواصلات', 'حافلة', 'حافله'] },
      { icon: 'washing-machine', keywords: ['laundry', 'wash', 'غسيل', 'مغسلة', 'مغسله'] },
      { icon: 'car', keywords: ['parking', 'موقف', 'جراج', 'كراج'] },
    ];
    return items.find(item =>
      item.keywords.some(keyword => name.includes(this.normalizeIconSearchValue(keyword)))
    )?.icon ?? 'settings';
  }
}
