import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ReviewImageComponent } from './review-image/review-image.component';
import { ReviewTermsComponent } from './review-terms/review-terms.component';
import { ReviewLicenseComponent } from './review-license/review-license.component';
import { ActivatedRoute, Router } from '@angular/router';
import { BuildingReviewService } from '../../services/building-review.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-build-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, ReviewImageComponent, ReviewTermsComponent, ReviewLicenseComponent, TranslateModule],
  templateUrl: './build-review.component.html',
  styleUrl: './build-review.component.scss'
})
export class BuildReviewComponent implements OnInit {
  currentView: 'list' | 'images' | 'terms' | 'license' | 'final' = 'list';
  buildingId: string | null = null;

  building = {
    id: 'H0042',
    name: 'برج ريتاج السكني',
    location: 'جدة حي الشاطئ، شارع الكورنيش',
    organization: 'مجموعة ريادة القلدقية',
    totalUnits: '٢٤',
    imageUrl: 'assets/images/building.jpg'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private buildingService: BuildingReviewService
  ) {}

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('id');
    if (this.buildingId) {
      const data = this.buildingService.getBuildingById(this.buildingId);
      if (data) {
        this.building = {
          id: data.id,
          name: data.title, // Note: using title key as name for simulation
          location: data.location,
          organization: 'مجموعة ريادة القلدقية',
          totalUnits: data.units.toString(),
          imageUrl: 'assets/images/building.jpg'
        };
      }
    }
  }

  reviewSections = [
    { 
        iconUrl: 'assets/images/svgs/SVG.svg',  
        title: 'صور المبنى',   
        completed: false, 
        status: 'pending',
        notes: 'يوجد ٣ صور مرفوضة لعدم وضوح المعالم، صورة المدخل مشوشة وصور المرافق غير مطابقة للواقع الجغرافي للمبنى.'
    },
    { 
        iconUrl: 'assets/images/svgs/SVG (1).svg',   
        title: 'شروط المبنى',  
        completed: false, 
        status: 'pending',
        notes: 'مواعيد تسجيل الدخول والخروج متأخرة جداً وغير متوافقة مع سياسة المنصة العامة، يرجى تعديلها لأوقات معيارية.'
    },
    { 
        iconUrl: 'assets/images/svgs/SVG (2).svg', 
        title: 'ترخيص المبنى', 
        completed: false, 
        status: 'pending',
        notes: 'صورة الترخيص المرفوعة غير واضحة المعالم، يرجى إرفاق نسخة رقمية واضحة ومقروءة من ترخيص وزارة السياحة.'
    }
  ];

  finalRejectionNotes = '';
  showSuccessModal = false;

  get completedCount(): number {
    return this.reviewSections.filter(s => s.completed).length;
  }

  get progressPercent(): number {
    return Math.round((this.completedCount / this.reviewSections.length) * 100);
  }

  get allSectionsComplete(): boolean {
    return this.reviewSections.every(s => s.completed);
  }

  get canReject(): boolean {
    return this.allSectionsComplete && this.finalRejectionNotes.trim().length > 0;
  }

  get canApprove(): boolean {
    return this.allSectionsComplete;
  }

  openSection(index: number): void {
    const views: ('images' | 'terms' | 'license')[] = ['images', 'terms', 'license'];
    
    if (index === 0 || this.reviewSections[index - 1].completed) {
      this.currentView = views[index];
    }
  }

  onBack(): void {
    if (this.currentView === 'list') {
        this.router.navigate(['../../buildings'], { relativeTo: this.route });
    } else {
        this.currentView = 'list';
    }
  }

  onSectionApproved(index: number, hasRejection: boolean = false): void {
    this.reviewSections[index].completed = true;
    this.reviewSections[index].status = hasRejection ? 'rejected' : 'accepted';
    
    if (this.allSectionsComplete) {
        this.currentView = 'final';
    } else {
        this.onBack();
    }
  }

  get isFinalSuccess(): boolean {
    return this.reviewSections.every(s => s.status === 'accepted');
  }

  get rejectedSectionsSummary() {
    return this.reviewSections.filter(s => s.status === 'rejected');
  }

  onReject(): void {
    if (!this.canReject) return;
    console.log('Rejecting with notes:', this.finalRejectionNotes);
  }

  onApprove(): void {
    if (!this.canApprove) return;
    if (this.buildingId) {
      this.buildingService.approveBuilding(this.buildingId);
    }
    this.showSuccessModal = true;
    console.log('Approving building:', this.building.name);
  }

  goToUnits(): void {
    console.log('Navigating back to buildings list...');
    this.router.navigate(['../../buildings'], { relativeTo: this.route });
    this.showSuccessModal = false;
  }

  closeModal(): void {
    this.showSuccessModal = false;
  }
}