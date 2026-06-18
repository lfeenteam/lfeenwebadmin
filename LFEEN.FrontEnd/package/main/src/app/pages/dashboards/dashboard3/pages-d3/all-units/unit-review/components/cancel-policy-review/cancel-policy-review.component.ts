import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';
import { BuildingWithUnits, CancelPolicyType, UnitCardItem } from '../../../../../interfaces/unit-card.model';

@Component({
  selector: 'app-cancel-policy-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './cancel-policy-review.component.html',
  styleUrl: './cancel-policy-review.component.scss'
})
export class CancelPolicyReviewComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly leadingNumberPattern = /^([0-9٠-٩۰-۹]+(?:[.,٫][0-9٠-٩۰-۹]+)?\s*(?:%|٪)?)/u;

  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  buildingId = '';
  unitId = '';
  rejectionNote = '';

  get policyType(): CancelPolicyType {
    return this.unit?.cancelPolicyType ?? 'non_refundable';
  }

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

  getValueNumber(value: string): string {
    return value.trim().match(this.leadingNumberPattern)?.[1].trim() ?? '';
  }

  getValueText(value: string): string {
    const trimmedValue = value.trim();
    const numberPart = this.getValueNumber(trimmedValue);
    return numberPart ? trimmedValue.slice(numberPart.length).trim() : trimmedValue;
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
    this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'cancelPolicy', decision);
    this.onBack();
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
