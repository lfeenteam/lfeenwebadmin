import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';
import { BuildingWithUnits, UnitCardItem, UnitServicesPricingType } from '../../../../../interfaces/unit-card.model';

interface ServiceItem {
  titleKey: string;
  descKey: string;
  icon: string;
  price?: number;
  freeInFreeMode?: boolean;
  muted?: boolean;
  enabled?: boolean;
}

interface ServiceGroup {
  titleKey: string;
  descKey: string;
  icon: string;
  items: ServiceItem[];
  compact?: boolean;
  grid?: boolean;
  type?: 'room' | 'wifi';
}

@Component({
  selector: 'app-unit-services-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './unit-services-review.component.html',
  styleUrl: './unit-services-review.component.scss'
})
export class UnitServicesReviewComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  buildingId = '';
  unitId = '';
  rejectionNote = '';
  currentLang = 'ar';

  readonly serviceGroups: ServiceGroup[] = [
    {
      titleKey: 'd3.unitReview.servicesView.parking.title',
      descKey: 'd3.unitReview.servicesView.parking.desc',
      icon: 'car',
      compact: true,
      items: [
        {
          titleKey: 'd3.unitReview.servicesView.parking.itemTitle',
          descKey: 'd3.unitReview.servicesView.parking.itemDesc',
          icon: 'car',
          price: 50,
          freeInFreeMode: true
        }
      ]
    },
    {
      titleKey: 'd3.unitReview.servicesView.food.title',
      descKey: 'd3.unitReview.servicesView.food.desc',
      icon: 'tools-kitchen-2',
      grid: true,
      items: [
        {
          titleKey: 'd3.unitReview.servicesView.food.breakfastTitle',
          descKey: 'd3.unitReview.servicesView.food.breakfastDesc',
          icon: 'sun',
          price: 50,
          freeInFreeMode: true,
          enabled: true
        },
        {
          titleKey: 'd3.unitReview.servicesView.food.lunchTitle',
          descKey: 'd3.unitReview.servicesView.food.lunchDesc',
          icon: 'sun',
          muted: true
        },
        {
          titleKey: 'd3.unitReview.servicesView.food.dinnerTitle',
          descKey: 'd3.unitReview.servicesView.food.dinnerDesc',
          icon: 'moon',
          muted: true
        }
      ]
    },
    {
      titleKey: 'd3.unitReview.servicesView.room.title',
      descKey: 'd3.unitReview.servicesView.room.desc',
      icon: 'sparkles',
      type: 'room',
      items: [
        {
          titleKey: 'd3.unitReview.servicesView.room.cleaningTitle',
          descKey: 'd3.unitReview.servicesView.room.cleaningDesc',
          icon: 'sparkles',
          price: 50,
          freeInFreeMode: true
        },
        {
          titleKey: 'd3.unitReview.servicesView.room.beddingTitle',
          descKey: 'd3.unitReview.servicesView.room.beddingDesc',
          icon: 'bed',
          price: 50,
          freeInFreeMode: true
        }
      ]
    },
    {
      titleKey: 'd3.unitReview.servicesView.wifi.title',
      descKey: 'd3.unitReview.servicesView.wifi.desc',
      icon: 'wifi',
      type: 'wifi',
      items: [
    
        {
          titleKey: 'd3.unitReview.servicesView.wifi.networkTitle',
          descKey: 'd3.unitReview.servicesView.wifi.networkValue',
          icon: 'wifi'
        } ,   {
          titleKey: 'd3.unitReview.servicesView.wifi.passwordTitle',
          descKey: 'd3.unitReview.servicesView.wifi.passwordValue',
          icon: 'key'
        },
      ]
    }
  ];

  get servicesPricingType(): UnitServicesPricingType {
    return this.unit?.servicesPricingType ?? 'paid';
  }

  get isFreeMode(): boolean {
    return this.servicesPricingType === 'free';
  }

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
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
      .subscribe(event => { this.currentLang = event.lang; });
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId = this.route.snapshot.paramMap.get('unitId') ?? '';

    this.unitsService.getBuildingsWithUnits().subscribe(buildings => {
      this.building = buildings.find(b => b.id === this.buildingId);
      this.unit = this.building?.units.find(u => u.id === this.unitId);
    });
  }

  isFreeItem(item: ServiceItem): boolean {
    return this.isFreeMode && !!item.freeInFreeMode;
  }

  itemPrice(item: ServiceItem): number | undefined {
    return this.isFreeItem(item) ? 0 : item.price;
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.buildingId || !this.unitId) return;
    this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'services', decision);
    this.onBack();
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
