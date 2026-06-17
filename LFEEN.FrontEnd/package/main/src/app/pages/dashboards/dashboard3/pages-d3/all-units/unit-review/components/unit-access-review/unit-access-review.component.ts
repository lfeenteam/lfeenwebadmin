import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { BuildingWithUnits, UnitCardItem } from '../../../../../interfaces/unit-card.model';
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

  readonly accessPhotos: AccessPhoto[] = [
    {
      image: 'assets/images/products/Screenshot_1.png',
      titleKey: 'd3.unitReview.accessView.photos.street',
      tagKey: 'd3.unitReview.accessView.tags.external',
      decision: 'approved',
      rejectionReason: '',
      suggestedSolution: ''
    },
    {
      image: 'assets/images/products/review_image1.jpg',
      titleKey: 'd3.unitReview.accessView.photos.mainEntrance',
      tagKey: 'd3.unitReview.accessView.tags.inside',
      decision: 'approved',
      rejectionReason: '',
      suggestedSolution: ''
    },
    {
      image: 'assets/images/products/s2.jpg',
      titleKey: 'd3.unitReview.accessView.photos.corridor',
      tagKey: 'd3.unitReview.accessView.tags.floor',
      decision: 'approved',
      rejectionReason: '',
      suggestedSolution: ''
    },
    {
      image: 'assets/images/products/s10.jpg',
      titleKey: 'd3.unitReview.accessView.photos.unitDoor',
      tagKey: 'd3.unitReview.accessView.tags.unit',
      decision: 'approved',
      rejectionReason: '',
      suggestedSolution: ''
    }
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

  setPhotoDecision(photo: AccessPhoto, decision: AccessPhotoDecision): void {
    photo.decision = decision;
    if (decision === 'approved') {
      photo.rejectionReason = '';
      photo.suggestedSolution = '';
    }
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.buildingId || !this.unitId) {
      return;
    }

    this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'access', decision);
    this.onBack();
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
