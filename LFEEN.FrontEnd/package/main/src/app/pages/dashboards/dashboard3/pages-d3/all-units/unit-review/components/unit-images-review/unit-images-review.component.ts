import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { BuildingWithUnits, UnitCardItem } from '../../../../../interfaces/unit-card.model';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';

type UnitPhotoDecision = 'pending' | 'approved' | 'rejected';

interface UnitReviewPhoto {
  id: number;
  url: string;
  titleKey: string;
  categoryKey: string;
  decision: UnitPhotoDecision;
  rejectionReason: string;
}

interface UnitPhotoGroup {
  titleKey: string;
  icon: string;
  photos: UnitReviewPhoto[];
}

@Component({
  selector: 'app-unit-images-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './unit-images-review.component.html',
  styleUrl: './unit-images-review.component.scss'
})
export class UnitImagesReviewComponent implements OnInit {
  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  buildingId = '';
  unitId = '';
  finalNotes = '';

  mainPhoto: UnitReviewPhoto = {
    id: 1,
    url: 'assets/images/products/review_image1.jpg',
    titleKey: 'd3.unitReview.imagesView.mainPhoto.name',
    categoryKey: 'd3.unitReview.imagesView.mainPhoto.category',
    decision: 'pending',
    rejectionReason: ''
  };

  readonly photoGroups: UnitPhotoGroup[] = [
    {
      titleKey: 'd3.unitReview.imagesView.groups.living',
      icon: 'sofa',
      photos: [
        this.createPhoto(2, 'assets/images/products/s1.jpg', 'livingDining', 'livingDiningCategory'),
        this.createPhoto(3, 'assets/images/products/s2.jpg', 'livingCorridor', 'livingCorridorCategory'),
        this.createPhoto(4, 'assets/images/products/s3.jpg', 'livingMain', 'livingMainCategory')
      ]
    },
    {
      titleKey: 'd3.unitReview.imagesView.groups.kitchen',
      icon: 'chef-hat',
      photos: [
        this.createPhoto(5, 'assets/images/products/s4.jpg', 'kitchenFull', 'kitchenCategory'),
        this.createPhoto(6, 'assets/images/products/s5.jpg', 'kitchenFull', 'kitchenCategory'),
        this.createPhoto(7, 'assets/images/products/s6.jpg', 'kitchenFull', 'kitchenCategory')
      ]
    },
    {
      titleKey: 'd3.unitReview.imagesView.groups.bedrooms',
      icon: 'bed',
      photos: [
        this.createPhoto(8, 'assets/images/products/s7.jpg', 'secondaryBedroom', 'secondaryBedroomCategory'),
        this.createPhoto(9, 'assets/images/products/s8.jpg', 'secondaryBedroom', 'secondaryBedroomCategory'),
        this.createPhoto(10, 'assets/images/products/s9.jpg', 'masterBedroom', 'masterBedroomCategory')
      ]
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

  get allPhotos(): UnitReviewPhoto[] {
    return [this.mainPhoto, ...this.photoGroups.flatMap(group => group.photos)];
  }

  get hasRejections(): boolean {
    return this.allPhotos.some(photo => photo.decision === 'rejected');
  }

  get rejectedPhotos(): UnitReviewPhoto[] {
    return this.allPhotos.filter(photo => photo.decision === 'rejected');
  }

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId = this.route.snapshot.paramMap.get('unitId') ?? '';

    this.unitsService.getBuildingsWithUnits().subscribe(buildings => {
      this.building = buildings.find(building => building.id === this.buildingId);
      this.unit = this.building?.units.find(unit => unit.id === this.unitId);
    });
  }

  setDecision(photo: UnitReviewPhoto, decision: Exclude<UnitPhotoDecision, 'pending'>): void {
    photo.decision = decision;
    if (decision === 'approved') {
      photo.rejectionReason = '';
    }
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.buildingId || !this.unitId) {
      return;
    }

    this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'photos', decision);
    this.onBack();
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  private createPhoto(id: number, url: string, titleKey: string, categoryKey: string): UnitReviewPhoto {
    return {
      id,
      url,
      titleKey: `d3.unitReview.imagesView.photos.${titleKey}`,
      categoryKey: `d3.unitReview.imagesView.categories.${categoryKey}`,
      decision: 'pending',
      rejectionReason: ''
    };
  }
}
