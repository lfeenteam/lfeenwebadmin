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
import { UnitPricingResponse } from '../../../../../interfaces/unit-card.model';
import { PageBreadcrumbTrailService } from '../../../../../services/page-breadcrumb-trail.service';
import { startOfMonth, getDay, getDaysInMonth, addMonths, subMonths, format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { ReviewEmptyStateComponent } from 'src/app/components/dashboard3/review-empty-state/review-empty-state.component';

interface CalendarDay {
  day: number | null;
  price: number | null;
  available: boolean;
}

interface SeasonalPeriod {
  label: string;
  name: string;
  dates: string;
}

interface PricingPolicyRow {
  labelKey: string;
  enabled: boolean;
  value: number | string;
}

interface PricingPolicy {
  titleKey: string;
  subtitleKey: string;
  icon: string;
  enabled: boolean;
  /** Shown only when the pricing endpoint returns this policy's toggle as true. */
  visible: boolean;
  rows: PricingPolicyRow[];
}

interface PlatformPricingRow {
  labelKey: string;
  enabled: boolean;
  price: number | string;
  discount: number | string;
}

@Component({
  selector: 'app-unit-pricing-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule, ReviewEmptyStateComponent],
  templateUrl: './unit-pricing-review.component.html',
  styleUrl: './unit-pricing-review.component.scss'
})
export class UnitPricingReviewComponent implements OnInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageBreadcrumbTrail = inject(PageBreadcrumbTrailService);

  buildingId = '';
  unitId = '';
  rejectionNote = '';
  currentMonth = new Date();
  basePrice: number | null = null;
  safetyFloorPrice: number | null = null;
  currentLang = 'ar';
  isReadOnly = false;

  seasonalPeriods: SeasonalPeriod[] = [];

  // Populated from the pricing endpoint in loadPricing(); "-" for missing values, and a whole
  // section is shown only when its toggle comes back true.
  pricingPolicies: PricingPolicy[] = [
    {
      titleKey: 'd3.unitReview.pricingView.policies.dayFraction.title',
      subtitleKey: 'd3.unitReview.pricingView.policies.stayDurationSubtitle',
      icon: 'clock',
      enabled: false,
      visible: false,
      rows: [
        { labelKey: 'd3.unitReview.pricingView.policies.dayFraction.quarterDay', enabled: false, value: '-' },
        { labelKey: 'd3.unitReview.pricingView.policies.dayFraction.halfDay', enabled: false, value: '-' },
      ],
    },
    {
      titleKey: 'd3.unitReview.pricingView.policies.longStay.title',
      subtitleKey: 'd3.unitReview.pricingView.policies.stayDurationSubtitle',
      icon: 'clock',
      enabled: false,
      visible: false,
      rows: [
        { labelKey: 'd3.unitReview.pricingView.policies.longStay.weekPlus', enabled: false, value: '-' },
        { labelKey: 'd3.unitReview.pricingView.policies.longStay.monthPlus', enabled: false, value: '-' },
      ],
    },
  ];

  showChannelPricing = false;
  platformPolicy: { enabled: boolean; rows: PlatformPricingRow[] } = {
    enabled: false,
    rows: [],
  };

  private calendarDaysMap = new Map<number, { price: number | null; isEnabled: boolean }>();

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
      const dayData = this.calendarDaysMap.get(d);
      cells.push({
        day: d,
        price: dayData?.price ?? null,
        available: dayData?.isEnabled ?? false,
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
    private translate: TranslateService,
    private dialog: MatDialog
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
    this.unitId     = this.route.snapshot.paramMap.get('unitId')     ?? '';
    this.isReadOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';

    if (this.unitId) {
      this.loadPricing();
      this.loadCalendar();
      this.unitsService.getUnitBasicData(this.unitId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(data => {
          const lang = this.translate.currentLang || 'ar';
          this.pageBreadcrumbTrail.set([
            { label: data.title ?? '', translate: false, route: ['/', lang, 'd3', 'unit-review', this.buildingId, this.unitId] }
          ]);
        });
    }
  }

  ngOnDestroy(): void {
    this.pageBreadcrumbTrail.clear();
  }

  private loadPricing(): void {
    this.unitsService.getUnitPricing(this.unitId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.basePrice = data.basePricePerNight ?? null;
        this.safetyFloorPrice = data.minimumPricePerNight ?? null;
        this.applyPricingPolicies(data);
        const locale = this.currentLang === 'en' ? enUS : ar;
        this.seasonalPeriods = (data.customPeriods ?? []).map((p, i) => {
          const start = p.startDate
            ? format(new Date(p.startDate), 'd MMMM yyyy', { locale })
            : '-';
          const end = p.endDate
            ? format(new Date(p.endDate), 'd MMMM yyyy', { locale })
            : '-';
          return {
            label: this.currentLang === 'en' ? `Period ${i + 1}` : `الفترة ${i + 1}`,
            name: p.name || '-',
            dates: `${start} - ${end}`,
          };
        });
      });
  }

  /**
   * Maps the pricing endpoint payload onto the policy cards.
   * Missing scalar values stay "-"; a section is shown only when its toggle is true.
   */
  private applyPricingPolicies(data: UnitPricingResponse): void {
    const [dayFractionCard, longStayCard] = this.pricingPolicies;

    // Day partitioning — matched by partitionKey ("quarter" / "half").
    dayFractionCard.visible = data.enableDayPartitioning === true;
    dayFractionCard.enabled = data.enableDayPartitioning ?? false;
    const quarter = (data.dayPartitions ?? []).find(p => p.partitionKey === 'quarter');
    const half = (data.dayPartitions ?? []).find(p => p.partitionKey === 'half');
    dayFractionCard.rows[0].value = quarter?.discountPercent ?? '-';
    dayFractionCard.rows[0].enabled = quarter?.isActive ?? false;
    dayFractionCard.rows[1].value = half?.discountPercent ?? '-';
    dayFractionCard.rows[1].enabled = half?.isActive ?? false;

    // Long stay — two buckets: week+ (< 28 nights) and month+ (>= 28 nights).
    longStayCard.visible = data.enableLongStayDiscount === true;
    longStayCard.enabled = data.enableLongStayDiscount ?? false;
    const rules = data.longStayRules ?? [];
    const weekRule = rules.find(r => r.minimumNights < 28);
    const monthRule = rules.find(r => r.minimumNights >= 28);
    longStayCard.rows[0].value = weekRule?.discountPercent ?? '-';
    longStayCard.rows[0].enabled = weekRule?.isActive ?? false;
    longStayCard.rows[1].value = monthRule?.discountPercent ?? '-';
    longStayCard.rows[1].enabled = monthRule?.isActive ?? false;

    // Platform / channel pricing — one row per returned channel.
    this.showChannelPricing = data.enableChannelPricing === true;
    this.platformPolicy.enabled = data.enableChannelPricing ?? false;
    this.platformPolicy.rows = (data.channels ?? []).map(channel => ({
      labelKey: channel.channelCode || '-',
      enabled: channel.isActive ?? false,
      price: channel.finalPrice ?? '-',
      discount: channel.changePercent ?? '-',
    }));
  }

  private loadCalendar(): void {
    const date = format(this.currentMonth, 'yyyy-MM-dd');
    this.unitsService.getUnitPricingCalendar(this.unitId, date)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.calendarDaysMap = new Map(
          data.days.map(d => [d.dayNumber, { price: d.price, isEnabled: d.isEnabled }])
        );
      });
  }

  prevMonth(): void {
    this.currentMonth = subMonths(this.currentMonth, 1);
    this.loadCalendar();
  }

  nextMonth(): void {
    this.currentMonth = addMonths(this.currentMonth, 1);
    this.loadCalendar();
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.unitId) return;
    const isApprove = decision === 'approved';
    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:   isApprove ? 'd3.unitReview.confirm.pricingApproveTitle'   : 'd3.unitReview.confirm.pricingRejectTitle',
        messageKey: isApprove ? 'd3.unitReview.confirm.pricingApproveMessage' : 'd3.unitReview.confirm.pricingRejectMessage',
        confirmKey: isApprove ? 'd3.unitReview.confirm.approveAction'         : 'd3.unitReview.confirm.rejectAction',
        tone: isApprove ? 'approve' : 'reject'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      const apiDecision = isApprove ? 'Approved' : 'Rejected';
      const rejectionReason = isApprove ? null : (this.rejectionNote.trim() || null);
      this.unitsService.reviewUnitPricing(this.unitId, apiDecision, rejectionReason).subscribe({
        next: () => {
          if (this.buildingId) {
            this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'pricing', decision);
          }
          this.onBack();
        }
      });
    });
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
