import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';
import { BuildingWithUnits, UnitCardItem } from '../../../../../interfaces/unit-card.model';

interface LicenseDetailItem {
  labelKey: string;
  valueKey: string;
  badgeKey?: string;
  wide?: boolean;
}

@Component({
  selector: 'app-unit-license-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './unit-license-review.component.html',
  styleUrl: './unit-license-review.component.scss'
})
export class UnitLicenseReviewComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  buildingId = '';
  unitId = '';
  rejectionNote = '';

  readonly documentSrc = 'assets/images/products/license_sample.png';

  readonly licenseDetails: LicenseDetailItem[] = [
    {
      labelKey: 'd3.unitReview.licenseView.details.numberLabel',
      valueKey: 'd3.unitReview.licenseView.details.numberValue',
      badgeKey: 'd3.unitReview.licenseView.details.verifiedBadge'
    },
    {
      labelKey: 'd3.unitReview.licenseView.details.statusLabel',
      valueKey: 'd3.unitReview.licenseView.details.statusValue',
      badgeKey: 'd3.unitReview.licenseView.details.statusBadge'
    },
    {
      labelKey: 'd3.unitReview.licenseView.details.issueDateLabel',
      valueKey: 'd3.unitReview.licenseView.details.issueDateValue'
    },
    {
      labelKey: 'd3.unitReview.licenseView.details.expiryDateLabel',
      valueKey: 'd3.unitReview.licenseView.details.expiryDateValue'
    },
    {
      labelKey: 'd3.unitReview.licenseView.details.sourceLabel',
      valueKey: 'd3.unitReview.licenseView.details.sourceValue',
      wide: true
    },
    {
      labelKey: 'd3.unitReview.licenseView.details.categoryLabel',
      valueKey: 'd3.unitReview.licenseView.details.categoryValue',
      wide: true
    }
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unitsService: UnitsService,
    private translate: TranslateService
  ) {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {});
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

  openDocument(): void {
    window.open(this.documentSrc, '_blank', 'noopener,noreferrer');
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.buildingId || !this.unitId) return;
    this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'license', decision);
    this.onBack();
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
