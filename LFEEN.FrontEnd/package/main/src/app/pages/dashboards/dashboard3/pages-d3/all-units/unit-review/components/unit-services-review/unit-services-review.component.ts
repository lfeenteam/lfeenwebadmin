import { Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { ReviewConfirmDialogComponent } from '../../../../build-review/review-confirm-dialog/review-confirm-dialog.component';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';
import {
  UnitServicesGroup,
  UnitServicesResponse,
  UnitServicesServiceItem,
} from '../../../../../interfaces/unit-card.model';
import { PageBreadcrumbTrailService } from '../../../../../services/page-breadcrumb-trail.service';

interface ServiceItem {
  id: string;
  titleKey?: string;
  title?: string;
  descKey?: string;
  desc?: string;
  icon: string;
  price?: number;
  freeInFreeMode?: boolean;
  muted?: boolean;
  enabled?: boolean;
}

interface ServiceGroup {
  id: string;
  titleKey?: string;
  titleAr?: string;
  titleEn?: string;
  descKey?: string;
  icon: string;
  items: ServiceItem[];
  compact?: boolean;
  grid?: boolean;
  type?: 'room' | 'wifi';
}

const GROUP_DESC_KEYS: Record<string, string> = {
  parking: 'd3.unitReview.servicesView.parking.desc',
  food: 'd3.unitReview.servicesView.food.desc',
  room: 'd3.unitReview.servicesView.room.desc',
  wifi: 'd3.unitReview.servicesView.wifi.desc',
};

const GROUP_ORDER = [
  'parking',
  'food',
  'standalone-cleaning',
  'room',
  'standalone-pricing',
  'standalone',
  'standalone-other',
  'wifi',
];

@Component({
  selector: 'app-unit-services-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule],
  templateUrl: './unit-services-review.component.html',
  styleUrl: './unit-services-review.component.scss'
})
export class UnitServicesReviewComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageBreadcrumbTrail = inject(PageBreadcrumbTrailService);

  buildingId = '';
  unitId = '';
  rejectionNote = '';
  currentLang = 'ar';
  isLoading = false;
  isReadOnly = false;
  serviceGroups: ServiceGroup[] = [];
  private servicesData: UnitServicesResponse | null = null;

  get isFreeMode(): boolean {
    const services = this.getAllServices();
    const configured = services.filter(s => this.isServiceConfigured(s));
    if (configured.length === 0) return false;
    return configured.every(s => s.isFree);
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  get hasRejectionNote(): boolean {
    return !!this.rejectionNote.trim();
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unitsService: UnitsService,
    private translate: TranslateService,
    private dialog: MatDialog
  ) {
    this.currentLang = this.translate.currentLang || 'ar';
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLang = event.lang;
        if (this.servicesData) {
          this.serviceGroups = this.mapApiToServiceGroups(this.servicesData);
        }
      });
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId = this.route.snapshot.paramMap.get('unitId') ?? '';
    this.isReadOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';

    if (!this.unitId) return;
    this.isLoading = true;
    this.unitsService.getUnitServices(this.unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.servicesData = data;
          this.rejectionNote = this.isReadOnly ? (data.rejectionReason ?? '') : '';
          this.serviceGroups = this.mapApiToServiceGroups(data);
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; }
      });
    this.unitsService.getUnitBasicData(this.unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        const lang = this.translate.currentLang || 'ar';
        this.pageBreadcrumbTrail.set([
          { label: data.title ?? '', translate: false, route: ['/', lang, 'd3', 'unit-review', this.buildingId, this.unitId] }
        ]);
      });
  }

  ngOnDestroy(): void {
    this.pageBreadcrumbTrail.clear();
  }

  groupTitle(group: ServiceGroup): string {
    if (group.titleKey) return this.translate.instant(group.titleKey);
    return this.currentLang === 'en'
      ? (group.titleEn ?? group.titleAr ?? '')
      : (group.titleAr ?? group.titleEn ?? '');
  }

  groupDesc(group: ServiceGroup): string {
    if (group.descKey) return this.translate.instant(group.descKey);
    return '';
  }

  itemTitle(item: ServiceItem): string {
    if (item.title) return item.title;
    if (item.titleKey) return this.translate.instant(item.titleKey);
    return '';
  }

  itemDesc(item: ServiceItem): string {
    if (item.desc) return item.desc;
    if (item.descKey) return this.translate.instant(item.descKey);
    return '';
  }

  isFreeItem(item: ServiceItem): boolean {
    return this.isFreeMode && !!item.freeInFreeMode;
  }

  itemPrice(item: ServiceItem): number | undefined {
    return this.isFreeItem(item) ? 0 : item.price;
  }

  priceDisplay(item: ServiceItem): string {
    if (this.isFreeItem(item)) {
      return this.translate.instant('d3.unitReview.servicesView.badges.free');
    }
    if (item.price != null) return String(item.price);
    return '—';
  }

  showCurrency(item: ServiceItem): boolean {
    return !this.isFreeItem(item) && item.price != null;
  }

  showInlinePrice(group: ServiceGroup): boolean {
    return group.type === 'room' || (!group.grid && !group.compact && group.type !== 'wifi');
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.unitId || this.isReadOnly) return;
    const isApprove = decision === 'approved';
    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:   isApprove ? 'd3.unitReview.confirm.servicesApproveTitle'   : 'd3.unitReview.confirm.servicesRejectTitle',
        messageKey: isApprove ? 'd3.unitReview.confirm.servicesApproveMessage' : 'd3.unitReview.confirm.servicesRejectMessage',
        confirmKey: isApprove ? 'd3.unitReview.confirm.approveAction'         : 'd3.unitReview.confirm.rejectAction',
        tone: isApprove ? 'approve' : 'reject'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      const apiDecision = isApprove ? 'Approved' : 'Rejected';
      const rejectionReason = isApprove ? null : (this.rejectionNote.trim() || null);
      this.unitsService.reviewUnitServices(this.unitId, apiDecision, rejectionReason)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            if (this.buildingId) {
              this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'services', decision);
            }
            this.onBack();
          }
        });
    });
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  private getAllServices(): UnitServicesServiceItem[] {
    return this.servicesData?.groups.flatMap(g => g.services) ?? [];
  }

  private isServiceConfigured(service: UnitServicesServiceItem): boolean {
    return service.isFree || service.cost != null;
  }

  private mapApiToServiceGroups(data: UnitServicesResponse): ServiceGroup[] {
    const groups: ServiceGroup[] = [];

    for (const apiGroup of data.groups) {
      if (apiGroup.groupKey === 'standalone') {
        const cleaning = apiGroup.services.filter(s => s.uiType === 'cleaning');
        const pricing = apiGroup.services.filter(s => s.uiType === 'pricing' && !s.hasWifiCredentials);
        const other = apiGroup.services.filter(
          s => s.uiType !== 'cleaning' && s.uiType !== 'pricing' && !s.hasWifiCredentials && s.uiType !== 'wifi'
        );

        if (cleaning.length) {
          const group = this.buildGroup('standalone-cleaning', apiGroup, cleaning, { type: 'room', icon: 'sparkles' });
          group.descKey = 'd3.unitReview.servicesView.room.desc';
          groups.push(group);
        }
        if (pricing.length) {
          groups.push(this.buildGroup('standalone-pricing', apiGroup, pricing, { type: 'room', icon: 'settings' }));
        }
        if (other.length) {
          groups.push(this.buildGroup('standalone-other', apiGroup, other, { icon: 'settings' }));
        }
        continue;
      }

      if (apiGroup.groupKey === 'wifi') {
        continue;
      }

      if (apiGroup.groupKey === 'parking') {
        groups.push(this.buildGroup(apiGroup.groupKey, apiGroup, apiGroup.services, { compact: true, icon: 'car' }));
        continue;
      }

      if (apiGroup.groupKey === 'food') {
        groups.push(this.buildGroup(apiGroup.groupKey, apiGroup, apiGroup.services, { grid: true, icon: 'tools-kitchen-2' }));
        continue;
      }

      if (apiGroup.groupKey === 'room') {
        groups.push(this.buildGroup(apiGroup.groupKey, apiGroup, apiGroup.services, { type: 'room', icon: 'sparkles' }));
        continue;
      }

      groups.push(this.buildGroup(apiGroup.groupKey, apiGroup, apiGroup.services, { icon: 'settings' }));
    }

    const allServices = data.groups.flatMap(g => g.services);
    const wifiService =
      data.groups.find(g => g.groupKey === 'wifi')?.services[0] ??
      allServices.find(s =>
        s.uiType === 'wifi' ||
        s.hasWifiCredentials ||
        s.isWifiConfigured ||
        s.serviceTypeNameKey.toLowerCase().includes('wifi')
      );
    groups.push(this.buildWifiGroup(wifiService));

    return groups.sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a.id);
      const bi = GROUP_ORDER.indexOf(b.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }

  private buildGroup(
    id: string,
    apiGroup: UnitServicesGroup,
    services: UnitServicesServiceItem[],
    layout: Pick<ServiceGroup, 'icon' | 'compact' | 'grid' | 'type'>
  ): ServiceGroup {
    const isFoodGrid = apiGroup.groupKey === 'food' || !!layout.grid;
    return {
      id,
      titleAr: apiGroup.groupNameAr,
      titleEn: apiGroup.groupNameEn,
      descKey: GROUP_DESC_KEYS[apiGroup.groupKey],
      icon: layout.icon,
      compact: layout.compact,
      grid: layout.grid,
      type: layout.type,
      items: services.map(s => this.mapServiceItem(s, isFoodGrid)),
    };
  }

  private buildWifiGroup(service?: UnitServicesServiceItem): ServiceGroup {
    return {
      id: 'wifi',
      titleKey: 'd3.unitReview.servicesView.wifi.title',
      descKey: 'd3.unitReview.servicesView.wifi.desc',
      icon: 'wifi',
      type: 'wifi',
      items: [
        {
          id: 'wifi-ssid',
          titleKey: 'd3.unitReview.servicesView.wifi.networkTitle',
          desc: service?.wifiSsid || '—',
          icon: 'wifi',
        },
        {
          id: 'wifi-password',
          titleKey: 'd3.unitReview.servicesView.wifi.passwordTitle',
          desc: service?.wifiPassword || '—',
          icon: 'key',
        },
      ],
    };
  }

  private mapServiceItem(service: UnitServicesServiceItem, isFoodGrid: boolean): ServiceItem {
    if (isFoodGrid) {
      return {
        id: String(service.serviceId),
        title: this.getFoodServiceLabel(service),
        icon: this.getServiceIcon(service),
        price: service.cost ?? undefined,
        freeInFreeMode: service.isFree,
        muted: false,
        enabled: true,
      };
    }

    const configured = this.isServiceConfigured(service);
    const title = this.getServiceLabel(service);

    return {
      id: String(service.serviceId),
      title,
      icon: this.getServiceIcon(service),
      price: service.cost ?? undefined,
      freeInFreeMode: service.isFree,
      muted: false,
      enabled: configured,
    };
  }

  private getFoodServiceLabel(service: UnitServicesServiceItem): string {
    const isAr = this.currentLang !== 'en';
    const primary   = isAr ? service.displayNameAr : service.displayNameEn;
    const secondary = isAr ? service.displayNameEn : service.displayNameAr;
    return primary ?? secondary ?? service.serviceTypeNameKey;
  }

  private getServiceLabel(service: UnitServicesServiceItem): string {
    const isAr = this.currentLang !== 'en';
    const primary   = isAr ? service.displayNameAr : service.displayNameEn;
    const secondary = isAr ? service.displayNameEn : service.displayNameAr;
    const isKey = (v: string | null) => !v || v.startsWith('ServiceType.');

    const raw = (!isKey(primary) ? primary : !isKey(secondary) ? secondary : null);
    if (raw) return raw;

    const translated = this.translate.instant(service.serviceTypeNameKey);
    if (translated !== service.serviceTypeNameKey) return translated;

    return this.fallbackFromServiceTypeKey(service.serviceTypeNameKey, isAr);
  }

  private fallbackFromServiceTypeKey(key: string, isAr: boolean): string {
    const mealLabels: Record<string, { ar: string; en: string }> = {
      Breakfast: { ar: 'وجبة الإفطار', en: 'Breakfast' },
      Lunch: { ar: 'وجبة الغداء', en: 'Lunch' },
      Dinner: { ar: 'وجبة العشاء', en: 'Dinner' },
      AllInclusiveMealPlan: { ar: 'خطة الإقامة الشاملة', en: 'All-inclusive Meal Plan' },
      Concierge: { ar: 'خدمة الكونسيرج', en: 'Concierge' },
      SharedFacilitiesCleaning: { ar: 'تنظيف المرافق المشتركة', en: 'Shared Facilities Cleaning' },
    };

    const match = key.match(/ServiceType\.(\w+)\./);
    if (match && mealLabels[match[1]]) {
      return isAr ? mealLabels[match[1]].ar : mealLabels[match[1]].en;
    }

    return match?.[1] ?? key;
  }

  private getServiceIcon(service: UnitServicesServiceItem): string {
    if (service.uiType === 'food_item') {
      if (service.serviceTypeNameKey.includes('Dinner')) return 'moon';
      if (service.serviceTypeNameKey.includes('Lunch')) return 'sun';
      return 'sun';
    }
    const icons: Record<string, string> = {
      cleaning: 'sparkles',
      pricing: 'car',
      wifi: 'wifi',
    };
    return icons[service.uiType] ?? 'settings';
  }
}
