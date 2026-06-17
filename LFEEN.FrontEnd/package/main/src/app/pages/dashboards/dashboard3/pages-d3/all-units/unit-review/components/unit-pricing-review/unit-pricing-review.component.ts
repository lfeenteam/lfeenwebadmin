import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';
import { BuildingWithUnits, UnitCardItem } from '../../../../../interfaces/unit-card.model';
import { startOfMonth, getDay, getDaysInMonth, addMonths, subMonths, format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

interface CalendarDay {
  day: number | null;
  price: number | null;
  available: boolean;
}

interface SeasonalPeriod {
  labelKey: string;
  nameKey: string;
  datesKey: string;
}

@Component({
  selector: 'app-unit-pricing-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './unit-pricing-review.component.html',
  styleUrl: './unit-pricing-review.component.scss'
})
export class UnitPricingReviewComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  buildingId = '';
  unitId = '';
  rejectionNote = '';
  currentMonth = new Date();
  basePrice = 500;
  currentLang = 'ar';

  get currencyIconSrc(): string {
    return this.currentLang === 'en'
      ? './assets/images/logos/saudi-riyal-en.svg'
      : './assets/images/logos/saudi-riyal.svg';
  }

  readonly dayHeaders = [
    'd3.unitReview.pricingView.days.sun',
    'd3.unitReview.pricingView.days.mon',
    'd3.unitReview.pricingView.days.tue',
    'd3.unitReview.pricingView.days.wed',
    'd3.unitReview.pricingView.days.thu',
    'd3.unitReview.pricingView.days.fri',
    'd3.unitReview.pricingView.days.sat',
  ];

  readonly seasonalPeriods: SeasonalPeriod[] = [
    {
      labelKey: 'd3.unitReview.pricingView.seasons.period1',
      nameKey: 'd3.unitReview.pricingView.seasons.summerName',
      datesKey: 'd3.unitReview.pricingView.seasons.summerDates',
    },
    {
      labelKey: 'd3.unitReview.pricingView.seasons.period2',
      nameKey: 'd3.unitReview.pricingView.seasons.summerName',
      datesKey: 'd3.unitReview.pricingView.seasons.summerDates',
    },
    {
      labelKey: 'd3.unitReview.pricingView.seasons.period3',
      nameKey: 'd3.unitReview.pricingView.seasons.summerName',
      datesKey: 'd3.unitReview.pricingView.seasons.summerDates',
    },
  ];

  private readonly pricedDays: Record<number, number> = {
    5: 500, 6: 500, 7: 500, 13: 500, 16: 500, 26: 500, 27: 500, 28: 500,
  };

  get currentMonthLabel(): string {
    return format(this.currentMonth, 'MMMM yyyy', {
      locale: this.currentLang === 'en' ? enUS : ar
    });
  }

  get calendarWeeks(): CalendarDay[][] {
    const firstDay = startOfMonth(this.currentMonth);
    const startDow = getDay(firstDay);
    const totalDays = getDaysInMonth(this.currentMonth);
    const cells: CalendarDay[] = [];

    for (let i = 0; i < startDow; i++) {
      cells.push({ day: null, price: null, available: false });
    }
    for (let d = 1; d <= totalDays; d++) {
      cells.push({
        day: d,
        price: this.pricedDays[d] ?? null,
        available: d in this.pricedDays,
      });
    }
    while (cells.length % 7 !== 0) {
      cells.push({ day: null, price: null, available: false });
    }

    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
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

  prevMonth(): void {
    this.currentMonth = subMonths(this.currentMonth, 1);
  }

  nextMonth(): void {
    this.currentMonth = addMonths(this.currentMonth, 1);
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.buildingId || !this.unitId) return;
    this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'pricing', decision);
    this.onBack();
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
