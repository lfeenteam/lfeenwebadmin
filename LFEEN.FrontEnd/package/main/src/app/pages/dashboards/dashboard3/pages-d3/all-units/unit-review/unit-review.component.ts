import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { UnitReviewDecision, UnitsService } from '../../../services/units.service';
import { BuildingWithUnits, UnitCardItem } from '../../../interfaces/unit-card.model';

interface UnitReviewSection {
  key: string;
  titleKey: string;
  descKey: string;
  icon: string;
  isSmartLockBadge: boolean;
  reviewBtnKey?: string;
}

@Component({
  selector: 'app-unit-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './unit-review.component.html',
  styleUrl: './unit-review.component.scss'
})
export class UnitReviewComponent implements OnInit {
  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;

  finalNotes = '';
  buildingId = '';
  unitId = '';
  reviewDecisions: Record<string, UnitReviewDecision> = {};

  readonly reviewSections: UnitReviewSection[] = [
    { key: 'basicInfo', titleKey: 'd3.unitReview.sections.basicInfo.title', descKey: 'd3.unitReview.sections.basicInfo.desc', icon: 'home', isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.basicInfo.btn' },
    { key: 'photos', titleKey: 'd3.unitReview.sections.photos.title', descKey: 'd3.unitReview.sections.photos.desc', icon: 'photo', isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.photos.btn' },
    { key: 'terms', titleKey: 'd3.unitReview.sections.terms.title', descKey: 'd3.unitReview.sections.terms.desc', icon: 'file-text', isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.terms.btn' },
    { key: 'pricing', titleKey: 'd3.unitReview.sections.pricing.title', descKey: 'd3.unitReview.sections.pricing.desc', icon: 'currency-dollar', isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.pricing.btn' },
    { key: 'smartLock', titleKey: 'd3.unitReview.sections.smartLock.title', descKey: 'd3.unitReview.sections.smartLock.desc', icon: 'lock', isSmartLockBadge: true },
    { key: 'access', titleKey: 'd3.unitReview.sections.access.title', descKey: 'd3.unitReview.sections.access.desc', icon: 'map-pin', isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.access.btn' },
    { key: 'cancelPolicy', titleKey: 'd3.unitReview.sections.cancelPolicy.title', descKey: 'd3.unitReview.sections.cancelPolicy.desc', icon: 'calendar-event', isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.cancelPolicy.btn' },
    { key: 'deposit', titleKey: 'd3.unitReview.sections.deposit.title', descKey: 'd3.unitReview.sections.deposit.desc', icon: 'shield-check', isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.deposit.btn' },
    { key: 'services', titleKey: 'd3.unitReview.sections.services.title', descKey: 'd3.unitReview.sections.services.desc', icon: 'settings', isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.services.btn' },
    { key: 'license', titleKey: 'd3.unitReview.sections.license.title', descKey: 'd3.unitReview.sections.license.desc', icon: 'certificate', isSmartLockBadge: false, reviewBtnKey: 'd3.unitReview.sections.license.btn' }
  ];

  readonly baseCompletedCount = 3;

  get completedCount(): number {
    return this.baseCompletedCount + Object.keys(this.reviewDecisions).length;
  }

  get totalCount(): number {
    return this.reviewSections.length;
  }

  get progressPercent(): number {
    return Math.round((this.completedCount / this.totalCount) * 100);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unitsService: UnitsService,
    private translate: TranslateService
  ) {}

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

    this.unitsService.getReviewDecisions().subscribe(decisions => {
      this.reviewDecisions = decisions;
    });
  }

  onBack(): void {
    this.router.navigate(['../../../units'], { relativeTo: this.route });
  }

  onReviewSection(section: UnitReviewSection): void {
    if (section.key === 'basicInfo') {
      this.router.navigate(['basic-info'], { relativeTo: this.route });
      return;
    }

    if (section.key === 'photos') {
      this.router.navigate(['photos'], { relativeTo: this.route });
      return;
    }

    if (section.key === 'terms') {
      this.router.navigate(['terms'], { relativeTo: this.route });
      return;
    }

    if (section.key === 'pricing') {
      this.router.navigate(['pricing'], { relativeTo: this.route });
      return;
    }

    if (section.key === 'access') {
      this.router.navigate(['access'], { relativeTo: this.route });
    }
  }

  getSectionDecision(sectionKey: string): UnitReviewDecision | undefined {
    if (!this.buildingId || !this.unitId) {
      return undefined;
    }

    return this.unitsService.getReviewDecision(this.buildingId, this.unitId, sectionKey);
  }
}
