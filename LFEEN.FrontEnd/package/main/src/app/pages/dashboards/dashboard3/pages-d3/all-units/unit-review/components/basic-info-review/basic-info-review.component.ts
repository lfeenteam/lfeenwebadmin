import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';
import { BuildingWithUnits, UnitCardItem, UnitFacilityStat, UnitRoomSection } from '../../../../../interfaces/unit-card.model';

@Component({
  selector: 'app-basic-info-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './basic-info-review.component.html',
  styleUrl: './basic-info-review.component.scss'
})
export class BasicInfoReviewComponent implements OnInit {
  building: BuildingWithUnits | undefined;
  unit: UnitCardItem | undefined;
  finalNotes = '';
  buildingId = '';
  unitId = '';

  readonly rooms: UnitRoomSection[] = [
    {
      icon: 'sofa',
      title: 'd3.unitReview.basicInfoView.rooms.mainHall.title',
      desc: 'd3.unitReview.basicInfoView.rooms.mainHall.desc',
      isOpen: true,
      amenities: [
        { icon: 'bed', label: 'd3.unitReview.basicInfoView.amenities.smartTv' },
        { icon: 'device-tv', label: 'd3.unitReview.basicInfoView.amenities.smartTvSmall' },
        { icon: 'tools-kitchen-2', label: 'd3.unitReview.basicInfoView.amenities.diningTable' },
        { icon: 'wifi', label: 'd3.unitReview.basicInfoView.amenities.fiberInternet' },
        { icon: 'snowflake', label: 'd3.unitReview.basicInfoView.amenities.smartAc' }
      ],
      services: [
        { icon: 'bed', label: 'd3.unitReview.basicInfoView.amenities.smartTv' },
        { icon: 'device-tv', label: 'd3.unitReview.basicInfoView.amenities.smartTvSmall' },
        { icon: 'tools-kitchen-2', label: 'd3.unitReview.basicInfoView.amenities.diningTable' },
        { icon: 'wifi', label: 'd3.unitReview.basicInfoView.amenities.fiberInternet' },
        { icon: 'snowflake', label: 'd3.unitReview.basicInfoView.amenities.smartAc' }
      ],
      subAreas: [
        {
          label: 'd3.unitReview.basicInfoView.subAreas.balcony',
          amenities: [
            { icon: 'grid-dots', label: 'd3.unitReview.basicInfoView.amenities.outdoorSeating' },
            { icon: 'lamp', label: 'd3.unitReview.basicInfoView.amenities.nightLighting' },
            { icon: 'leaf', label: 'd3.unitReview.basicInfoView.amenities.noExtraSystem' }
          ],
          services: [
            { icon: 'grid-dots', label: 'd3.unitReview.basicInfoView.amenities.outdoorSeating' },
            { icon: 'lamp', label: 'd3.unitReview.basicInfoView.amenities.nightLighting' },
            { icon: 'leaf', label: 'd3.unitReview.basicInfoView.amenities.noExtraSystem' }
          ]
        }
      ]
    },
    {
      icon: 'bed',
      title: 'd3.unitReview.basicInfoView.rooms.masterBedroom.title',
      desc: 'd3.unitReview.basicInfoView.rooms.masterBedroom.desc',
      badge: 'd3.unitReview.basicInfoView.badges.kingBed',
      isOpen: true,
      amenities: [
        { icon: 'bed', label: 'd3.unitReview.basicInfoView.amenities.kingBed' },
        { icon: 'device-tv', label: 'd3.unitReview.basicInfoView.amenities.smartTvSmall' },
        { icon: 'tools-kitchen-2', label: 'd3.unitReview.basicInfoView.amenities.diningTable' },
        { icon: 'wifi', label: 'd3.unitReview.basicInfoView.amenities.fiberInternet' },
        { icon: 'snowflake', label: 'd3.unitReview.basicInfoView.amenities.smartAc' }
      ],
      services: [
        { icon: 'bed', label: 'd3.unitReview.basicInfoView.amenities.kingBed' },
        { icon: 'device-tv', label: 'd3.unitReview.basicInfoView.amenities.smartTvSmall' },
        { icon: 'tools-kitchen-2', label: 'd3.unitReview.basicInfoView.amenities.diningTable' },
        { icon: 'wifi', label: 'd3.unitReview.basicInfoView.amenities.fiberInternet' },
        { icon: 'snowflake', label: 'd3.unitReview.basicInfoView.amenities.smartAc' }
      ],
      subAreas: [
        {
          label: 'd3.unitReview.basicInfoView.subAreas.balcony',
          amenities: [
            { icon: 'grid-dots', label: 'd3.unitReview.basicInfoView.amenities.outdoorSeating' },
            { icon: 'lamp', label: 'd3.unitReview.basicInfoView.amenities.nightLighting' },
            { icon: 'leaf', label: 'd3.unitReview.basicInfoView.amenities.noExtraSystem' }
          ],
          services: [
            { icon: 'grid-dots', label: 'd3.unitReview.basicInfoView.amenities.outdoorSeating' },
            { icon: 'lamp', label: 'd3.unitReview.basicInfoView.amenities.nightLighting' },
            { icon: 'leaf', label: 'd3.unitReview.basicInfoView.amenities.noExtraSystem' }
          ]
        }
      ]
    },
    {
      icon: 'bed',
      title: 'd3.unitReview.basicInfoView.rooms.secondaryBedroom.title',
      desc: 'd3.unitReview.basicInfoView.rooms.secondaryBedroom.desc',
      badge: 'd3.unitReview.basicInfoView.badges.singleBed',
      isOpen: true,
      amenities: [
        { icon: 'bed', label: 'd3.unitReview.basicInfoView.amenities.singleBed' },
        { icon: 'device-tv', label: 'd3.unitReview.basicInfoView.amenities.smartTvSmall' },
        { icon: 'tools-kitchen-2', label: 'd3.unitReview.basicInfoView.amenities.diningTable' },
        { icon: 'wifi', label: 'd3.unitReview.basicInfoView.amenities.fiberInternet' },
        { icon: 'snowflake', label: 'd3.unitReview.basicInfoView.amenities.smartAc' }
      ],
      services: [
        { icon: 'bed', label: 'd3.unitReview.basicInfoView.amenities.singleBed' },
        { icon: 'device-tv', label: 'd3.unitReview.basicInfoView.amenities.smartTvSmall' },
        { icon: 'tools-kitchen-2', label: 'd3.unitReview.basicInfoView.amenities.diningTable' },
        { icon: 'wifi', label: 'd3.unitReview.basicInfoView.amenities.fiberInternet' },
        { icon: 'snowflake', label: 'd3.unitReview.basicInfoView.amenities.smartAc' }
      ],
      subAreas: [
        {
          label: 'd3.unitReview.basicInfoView.subAreas.balcony',
          amenities: [
            { icon: 'grid-dots', label: 'd3.unitReview.basicInfoView.amenities.outdoorSeating' },
            { icon: 'lamp', label: 'd3.unitReview.basicInfoView.amenities.nightLighting' },
            { icon: 'leaf', label: 'd3.unitReview.basicInfoView.amenities.noExtraSystem' }
          ],
          services: [
            { icon: 'grid-dots', label: 'd3.unitReview.basicInfoView.amenities.outdoorSeating' },
            { icon: 'lamp', label: 'd3.unitReview.basicInfoView.amenities.nightLighting' },
            { icon: 'leaf', label: 'd3.unitReview.basicInfoView.amenities.noExtraSystem' }
          ]
        }
      ]
    }
  ];

  readonly facilityStats: UnitFacilityStat[] = [
    { label: 'd3.unitReview.basicInfoView.facilitiesSummary.cleaning', value: 'd3.unitReview.basicInfoView.facilitiesSummary.cleaningValue' },
    { label: 'd3.unitReview.basicInfoView.facilitiesSummary.security', value: 'd3.unitReview.basicInfoView.facilitiesSummary.securityValue' },
    { label: 'd3.unitReview.basicInfoView.facilitiesSummary.internet', value: 'd3.unitReview.basicInfoView.facilitiesSummary.internetValue' },
    { label: 'd3.unitReview.basicInfoView.facilitiesSummary.location', value: 'd3.unitReview.basicInfoView.facilitiesSummary.locationValue' }
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
      this.building = buildings.find(b => b.id === this.buildingId);
      this.unit = this.building?.units.find(u => u.id === this.unitId);
    });
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  toggleRoom(room: UnitRoomSection): void {
    room.isOpen = !room.isOpen;
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.buildingId || !this.unitId) {
      return;
    }

    this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'basicInfo', decision);
    this.onBack();
  }
}
