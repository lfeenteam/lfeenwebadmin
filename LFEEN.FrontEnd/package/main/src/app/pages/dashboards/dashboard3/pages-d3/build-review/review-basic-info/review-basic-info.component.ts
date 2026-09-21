import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import {
  BasicDataReviewPayload,
  BasicDataReviewResponse,
  BuildingReviewInfo,
  PropertyBasicDataResponse
} from '../../../interfaces/building-card.model';
import { ReviewConfirmDialogComponent } from '../review-confirm-dialog/review-confirm-dialog.component';
import { BuildingReviewService } from '../../../services/building-review.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReviewEmptyStateComponent } from 'src/app/components/dashboard3/review-empty-state/review-empty-state.component';

@Component({
  selector: 'app-review-basic-info',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, ReviewEmptyStateComponent],
  templateUrl: './review-basic-info.component.html',
  styleUrl: './review-basic-info.component.scss'
})
export class ReviewBasicInfoComponent implements OnInit {
  @Input() building!: BuildingReviewInfo;
  @Input() propertyId = '';
  @Input() readOnly = false;
  @Output() back = new EventEmitter<void>();
  @Output() approve = new EventEmitter<BasicDataReviewResponse>();

  private buildingService = inject(BuildingReviewService);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  basicData: PropertyBasicDataResponse | null = null;
  isLoading = false;
  isSubmitting = false;
  rejectionReason = '';

  ngOnInit(): void {
    // The backend localizes propertyTypeName/usage/service & facility names based on
    // the Accept-Language header (set from the current language at request time), so
    // a language toggle needs a fresh fetch — the strings won't retranslate on their own.
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadBasicData());

    this.loadBasicData();
  }

  private loadBasicData(): void {
    if (!this.propertyId) return;

    this.isLoading = true;
    this.buildingService.getPropertyBasicData(this.propertyId).subscribe({
      next: (data) => {
        this.isLoading = false;
        this.basicData = data;
        this.rejectionReason = data.rejectionReason ?? '';
      },
      error: () => {
        this.isLoading = false;
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
      }
    });
  }

  get controlFeatures() {
    return [
      {
        icon: 'key',
        titleKey: 'd3.buildReview.basicInfo.smartLockTitle',
        descKey: 'd3.buildReview.basicInfo.smartLockDesc',
        enabled: !!this.basicData?.hasLock
      },
      {
        icon: 'box',
        titleKey: 'd3.buildReview.basicInfo.extraServicesTitle',
        descKey: 'd3.buildReview.basicInfo.extraServicesDesc',
        enabled: !!this.basicData?.hasUnitServices
      }
    ];
  }

  get totalFloors(): number {
    return this.basicData?.numberOfFloors ?? 0;
  }

  get floors() {
    return (this.basicData?.floors ?? [])
      .slice()
      .sort((a, b) => a.floorIndex - b.floorIndex)
      .map(floor => ({
        number: String(floor.floorIndex + 1).padStart(2, '0'),
        name: floor.name,
        units: floor.unitCount
      }));
  }

  get viewTypeNames(): string[] {
    return (this.basicData?.availableViewTypes ?? [])
      .map(view => view.name?.trim())
      .filter((name): name is string => !!name);
  }

  get amenities(): { icon: string; label: string }[] {
    const services = (this.basicData?.services ?? []).map(service => ({
      icon: this.getServiceIcon(service.serviceTypeNameKey),
      label: service.displayName
    }));
    const facilities = (this.basicData?.facilities ?? []).map(facility => ({
      icon: this.getFacilityIcon(facility.facilityTypeName),
      label: facility.facilityTypeName
    }));
    return [...services, ...facilities];
  }

  private normalizeIconSearchValue(value: string): string {
    return value
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[ً-ْ]/g, '')
      .trim();
  }

  private matchIcon(value: string, items: { icon: string; keywords: string[] }[], fallback: string): string {
    const name = this.normalizeIconSearchValue(value);

    return items.find(item =>
      item.keywords.some(keyword => name.includes(this.normalizeIconSearchValue(keyword)))
    )?.icon ?? fallback;
  }

  private getFacilityIcon(facilityTypeName: string): string {
    return this.matchIcon(facilityTypeName, [
      { icon: 'device-tv', keywords: ['tv', 'television', 'screen', 'تلفزيون', 'شاشة', 'شاشه'] },
      { icon: 'wifi', keywords: ['wifi', 'wi-fi', 'internet', 'واي فاي', 'انترنت', 'إنترنت'] },
      { icon: 'snowflake', keywords: ['ac', 'air', 'cool', 'conditioner', 'مكيف', 'تكييف', 'تبريد'] },
      { icon: 'bed', keywords: ['bed', 'mattress', 'سرير', 'مرتبة', 'مرتبه'] },
      { icon: 'table', keywords: ['desk', 'table', 'مكتب', 'طاولة', 'طاوله'] },
      { icon: 'hanger', keywords: ['hanger', 'cloth', 'clothes', 'شماعة', 'شماعه', 'شماعات', 'ملابس'] },
      { icon: 'archive', keywords: ['wardrobe', 'closet', 'cabinet', 'خزانة', 'خزانه', 'دولاب'] },
      { icon: 'layout-sidebar', keywords: ['curtain', 'blind', 'blackout', 'ستائر', 'ستارة', 'ستاره', 'تعتيم'] },
      { icon: 'armchair', keywords: ['sofa', 'couch', 'chair', 'كرسي', 'كنبة', 'كنبه', 'اريكة', 'اريكه'] },
      { icon: 'tools-kitchen-2', keywords: ['kitchen', 'cook', 'restaurant', 'dining', 'مطبخ', 'مطعم', 'طعام', 'سفرة', 'سفره'] },
      { icon: 'ripple', keywords: ['pool', 'swim', 'مسبح', 'حمام سباحة', 'سباحه'] },
      { icon: 'barbell', keywords: ['gym', 'fitness', 'جيم', 'نادي رياضي', 'رياضة', 'رياضه'] },
      { icon: 'car', keywords: ['parking', 'park', 'موقف', 'جراج', 'كراج', 'سيارة', 'سياره'] },
      { icon: 'elevator', keywords: ['elevator', 'lift', 'مصعد', 'اسانسير'] },
      { icon: 'building', keywords: ['balcony', 'terrace', 'شرفة', 'شرفه', 'بلكونة', 'بلكونه', 'تراس'] },
      { icon: 'shower-head', keywords: ['shower', 'دش', 'شاور'] },
      { icon: 'bath', keywords: ['bath', 'bathroom', 'حمام', 'بانيو'] },
      { icon: 'lock', keywords: ['safe', 'lock', 'خزنة', 'خزنه', 'قفل', 'امان', 'أمان'] },
      { icon: 'ironing', keywords: ['iron', 'مكواة', 'مكواه', 'كي'] },
      { icon: 'coffee', keywords: ['coffee', 'kettle', 'قهوة', 'قهوه', 'غلاية', 'غلايه'] },
      { icon: 'fridge', keywords: ['fridge', 'refrigerator', 'ثلاجة', 'ثلاجه'] },
      { icon: 'microwave', keywords: ['microwave', 'oven', 'ميكرويف', 'فرن'] },
      { icon: 'washing-machine', keywords: ['wash', 'laundry', 'washing', 'غسيل', 'غسالة', 'غساله', 'مغسلة', 'مغسله'] }
    ], 'check');
  }

  private getServiceIcon(serviceTypeNameKey: string): string {
    return this.matchIcon(serviceTypeNameKey, [
      { icon: 'sparkles', keywords: ['cleaning', 'clean', 'نظافة', 'نظافه', 'تنظيف'] },
      { icon: 'user-circle', keywords: ['concierge', 'كونسيرج', 'استقبال', 'بواب'] },
      { icon: 'coffee', keywords: ['breakfast', 'فطار', 'افطار', 'إفطار'] },
      { icon: 'soup', keywords: ['lunch', 'dinner', 'meal', 'غداء', 'عشاء', 'وجبة', 'وجبه', 'طعام'] },
      { icon: 'wifi', keywords: ['wifi', 'wi-fi', 'internet', 'واي فاي', 'انترنت', 'إنترنت'] },
      { icon: 'bus', keywords: ['transport', 'shuttle', 'نقل', 'مواصلات', 'حافلة', 'حافله'] },
      { icon: 'washing-machine', keywords: ['laundry', 'wash', 'غسيل', 'مغسلة', 'مغسله'] },
      { icon: 'car', keywords: ['parking', 'موقف', 'جراج', 'كراج'] },
      { icon: 'door-enter', keywords: ['checkin', 'check-in', 'دخول', 'تسجيل وصول'] },
      { icon: 'door-exit', keywords: ['checkout', 'check-out', 'خروج', 'تسجيل مغادرة', 'تسجيل مغادره'] },
      { icon: 'barbell', keywords: ['gym', 'fitness', 'جيم', 'نادي رياضي', 'رياضة', 'رياضه'] }
    ], 'settings');
  }

  confirmDecision(decision: 'Approved' | 'Rejected'): void {
    if (this.isLoading || this.isSubmitting) return;

    const reason = this.rejectionReason.trim();
    if (decision === 'Rejected' && !reason) {
      this.toastr.warning(this.translate.instant('d3.buildReview.basicInfo.rejectionReasonRequired'));
      return;
    }

    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.basicInfoRejectTitle'
          : 'd3.buildReview.confirm.basicInfoApproveTitle',
        messageKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.basicInfoRejectMessage'
          : 'd3.buildReview.confirm.basicInfoApproveMessage',
        confirmKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.rejectAction'
          : 'd3.buildReview.confirm.approveAction',
        tone: decision === 'Rejected' ? 'reject' : 'approve'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) this.submitDecision(decision);
    });
  }

  private submitDecision(decision: 'Approved' | 'Rejected'): void {
    if (!this.propertyId || this.isSubmitting) return;

    const payload: BasicDataReviewPayload = {
      decision: decision === 'Rejected' ? '2' : '1',
      rejectionReason: decision === 'Rejected' ? this.rejectionReason.trim() : null
    };

    this.isSubmitting = true;
    this.buildingService.submitBasicDataReview(this.propertyId, payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        const messageKey = response.decision === 'Rejected'
          ? 'd3.buildReview.basicInfo.rejectSuccess'
          : 'd3.buildReview.basicInfo.approveSuccess';
        this.toastr.success(this.translate.instant(messageKey));
        this.approve.emit(response);
      },
      error: (err) => {
        this.isSubmitting = false;
        const errorCode = err?.error?.code ?? err?.error?.errorCode;
        const messageKey = errorCode === 'REJECTION_REASON_REQUIRED'
          ? 'd3.buildReview.basicInfo.rejectionReasonRequired'
          : 'd3.toast.errorOp';
        this.toastr.error(this.translate.instant(messageKey));
      }
    });
  }
}
