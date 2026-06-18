import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';
import { BuildingWithUnits, UnitCardItem } from '../../../../../interfaces/unit-card.model';

@Component({
  selector: 'app-unit-deposit-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './unit-deposit-review.component.html',
  styleUrl: './unit-deposit-review.component.scss'
})
export class UnitDepositReviewComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  buildingId = '';
  unitId = '';
  rejectionNote = '';
  currentLang = 'ar';
  depositAmount = 500;

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

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.buildingId || !this.unitId) return;
    this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'deposit', decision);
    this.onBack();
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
