import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { BuildingWithUnits, UnitAccessResponse, UnitCardItem } from '../../../../../interfaces/unit-card.model';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';

type AccessPhotoDecision = 'approved' | 'rejected';

interface AccessPhoto {
  image: string;
  titleKey: string;
  tagKey: string;
  decision: AccessPhotoDecision;
  rejectionReason: string;
  suggestedSolution: string;
}

const CATEGORY_MAP: Record<string, { titleKey: string; tagKey: string }> = {
  BuildingExterior: {
    titleKey: 'd3.unitReview.accessView.photos.street',
    tagKey:   'd3.unitReview.accessView.tags.external',
  },
  BuildingEntrance: {
    titleKey: 'd3.unitReview.accessView.photos.mainEntrance',
    tagKey:   'd3.unitReview.accessView.tags.inside',
  },
  Hallway: {
    titleKey: 'd3.unitReview.accessView.photos.corridor',
    tagKey:   'd3.unitReview.accessView.tags.floor',
  },
  UnitDoor: {
    titleKey: 'd3.unitReview.accessView.photos.unitDoor',
    tagKey:   'd3.unitReview.accessView.tags.unit',
  },
};

@Component({
  selector: 'app-unit-access-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './unit-access-review.component.html',
  styleUrl: './unit-access-review.component.scss'
})
export class UnitAccessReviewComponent implements OnInit {
  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  buildingId = '';
  unitId = '';
  note = '';
  isLoading = false;
  accessData: UnitAccessResponse | null = null;
  accessPhotos: AccessPhoto[] = [];

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
    this.unitId     = this.route.snapshot.paramMap.get('unitId')     ?? '';

    this.unitsService.getBuildingsWithUnits().subscribe(buildings => {
      this.building = buildings.find(b => b.id === this.buildingId);
      this.unit     = this.building?.units.find(u => u.id === this.unitId);
    });

    if (this.unitId) {
      this.isLoading = true;
      this.unitsService.getUnitAccess(this.unitId).subscribe({
        next: (data) => {
          this.accessData   = data;
          this.accessPhotos = data.photos.map(p => ({
            image:             p.imageUrl,
            titleKey:          CATEGORY_MAP[p.category]?.titleKey ?? p.category,
            tagKey:            CATEGORY_MAP[p.category]?.tagKey   ?? '',
            decision:          'approved' as AccessPhotoDecision,
            rejectionReason:   '',
            suggestedSolution: '',
          }));
          this.isLoading = false;
        },
        error: () => { this.isLoading = false; }
      });
    }
  }

  setPhotoDecision(photo: AccessPhoto, decision: AccessPhotoDecision): void {
    photo.decision = decision;
    if (decision === 'approved') {
      photo.rejectionReason   = '';
      photo.suggestedSolution = '';
    }
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.buildingId || !this.unitId) return;
    this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'access', decision);
    this.onBack();
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
