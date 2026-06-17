import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { BuildingWithUnits, UnitCardItem } from '../../../../../interfaces/unit-card.model';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';

interface UnitRule {
  icon: string;
  labelKey: string;
  approved: boolean;
}

@Component({
  selector: 'app-unit-terms-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './unit-terms-review.component.html',
  styleUrl: './unit-terms-review.component.scss'
})
export class UnitTermsReviewComponent implements OnInit {
  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  buildingId = '';
  unitId = '';
  finalNotes = '';
  earlyCheckInEnabled = true;

  readonly generalRules: UnitRule[] = [
    { icon: 'mood-kid', labelKey: 'd3.unitReview.termsView.generalRules.children', approved: true },
    { icon: 'mood-kid', labelKey: 'd3.unitReview.termsView.generalRules.children', approved: true },
    { icon: 'mood-kid', labelKey: 'd3.unitReview.termsView.generalRules.children', approved: true },
    { icon: 'music', labelKey: 'd3.unitReview.termsView.generalRules.parties', approved: false }
  ];

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
      this.building = buildings.find(building => building.id === this.buildingId);
      this.unit = this.building?.units.find(unit => unit.id === this.unitId);
    });
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.buildingId || !this.unitId) {
      return;
    }

    this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'terms', decision);
    this.onBack();
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
