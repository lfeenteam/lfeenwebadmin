import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { ReviewConfirmDialogComponent } from '../../../../build-review/review-confirm-dialog/review-confirm-dialog.component';
import { UnitReviewDecision, UnitsService } from '../../../../../services/units.service';
import {
  UnitBasicDataResponse,
  UnitBasicDataRoom,
  UnitBasicDataService,
  UnitAmenityItem,
  UnitRoomSection,
  UnitSubArea
} from '../../../../../interfaces/unit-card.model';
import { PageBreadcrumbTrailService } from '../../../../../services/page-breadcrumb-trail.service';
import { ReviewEmptyStateComponent } from 'src/app/components/dashboard3/review-empty-state/review-empty-state.component';

@Component({
  selector: 'app-basic-info-review',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule, ReviewEmptyStateComponent],
  templateUrl: './basic-info-review.component.html',
  styleUrl: './basic-info-review.component.scss'
})
export class BasicInfoReviewComponent implements OnInit, OnDestroy {
  private langSub?: Subscription;
  unitData: UnitBasicDataResponse | null = null;
  dynamicRooms: UnitRoomSection[] = [];
  finalNotes = '';
  buildingId = '';
  unitId = '';
  isLoading = false;
  isReadOnly = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private unitsService: UnitsService,
    private translate: TranslateService,
    private dialog: MatDialog,
    private pageBreadcrumbTrail: PageBreadcrumbTrailService
  ) {}

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get unitTitle(): string { return this.unitData?.title ?? ''; }

  get unitLocation(): string {
    return [this.unitData?.propertyName, this.unitData?.district].filter(Boolean).join(' - ');
  }

  get unitNumber(): string { return String(this.unitData?.apartmentNumberInFloor ?? ''); }
  get unitType(): string   { return this.unitData?.unitTypeName ?? ''; }
  get unitFloor(): string  { return String(this.unitData?.floorNumber ?? ''); }

  get unitArea(): string {
    return this.unitData?.sizeM != null ? `${this.unitData.sizeM} م²` : '';
  }

  get unitCapacity(): string {
    return this.unitData?.maxGuests != null ? String(this.unitData.maxGuests) : '';
  }

  get hasLock(): boolean { return this.unitData?.hasLock ?? false; }

  get unitFacilities(): string[] {
    return this.unitData?.facilities.map(f => f.facilityTypeName) ?? [];
  }

  get unitServices(): UnitBasicDataService[] { return this.unitData?.services ?? []; }

  get hasRoomsData(): boolean {
    return this.dynamicRooms.length > 0 || this.unitFacilities.length > 0 || this.unitServices.length > 0;
  }

  ngOnInit(): void {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    this.unitId     = this.route.snapshot.paramMap.get('unitId')     ?? '';
    this.isReadOnly = this.route.snapshot.queryParamMap.get('mode') === 'view';

    if (this.unitId) {
      this.isLoading = true;
      this.unitsService.getUnitBasicData(this.unitId).subscribe({
        next: (data) => {
          this.unitData     = data;
          this.dynamicRooms = this.mapRooms(data.rooms);
          this.isLoading    = false;
          const lang = this.translate.currentLang || 'ar';
          this.pageBreadcrumbTrail.set([
            { label: data.title ?? '', translate: false, route: ['/', lang, 'd3', 'unit-review', this.buildingId, this.unitId] }
          ]);
        },
        error: () => { this.isLoading = false; }
      });
    }

    this.langSub = this.translate.onLangChange.subscribe(() => {
      if (this.unitData) {
        this.dynamicRooms = this.mapRooms(this.unitData.rooms);
      }
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
    this.pageBreadcrumbTrail.clear();
  }

  getServiceLabel(service: UnitBasicDataService): string {
    const isKey = (v: string | null) => !v || v.startsWith('ServiceType.');

    if (!isKey(service.displayName)) return service.displayName as string;

    const translated = this.translate.instant(service.serviceTypeNameKey);
    if (translated !== service.serviceTypeNameKey) return translated;

    return this.fallbackFromServiceTypeKey(service.serviceTypeNameKey);
  }

  private fallbackFromServiceTypeKey(key: string): string {
    const match = key.match(/ServiceType\.(\w+)\./);
    return match?.[1] ?? key;
  }

  onBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  toggleRoom(room: UnitRoomSection): void {
    room.isOpen = !room.isOpen;
  }

  submitDecision(decision: UnitReviewDecision): void {
    if (!this.unitId) return;
    const isApprove = decision === 'approved';
    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey:   isApprove ? 'd3.unitReview.confirm.basicInfoApproveTitle'   : 'd3.unitReview.confirm.basicInfoRejectTitle',
        messageKey: isApprove ? 'd3.unitReview.confirm.basicInfoApproveMessage' : 'd3.unitReview.confirm.basicInfoRejectMessage',
        confirmKey: isApprove ? 'd3.unitReview.confirm.approveAction'           : 'd3.unitReview.confirm.rejectAction',
        tone: isApprove ? 'approve' : 'reject'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      const apiDecision = isApprove ? 'Approved' : 'Rejected';
      const rejectionReason = isApprove ? null : (this.finalNotes.trim() || null);
      this.unitsService.reviewUnitBasicData(this.unitId, apiDecision, rejectionReason).subscribe({
        next: () => {
          if (this.buildingId) {
            this.unitsService.setReviewDecision(this.buildingId, this.unitId, 'basicInfo', decision);
          }
          this.onBack();
        }
      });
    });
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

  private getRoomIcon(roomTypeName: string): string {
    return this.matchIcon(roomTypeName, [
      { icon: 'bath', keywords: ['bath', 'bathroom', 'حمام'] },
      { icon: 'bed', keywords: ['bed', 'sleep', 'bedroom', 'غرفة نوم', 'غرفه نوم', 'نوم'] },
      { icon: 'tools-kitchen-2', keywords: ['kitchen', 'مطبخ'] },
      { icon: 'sofa', keywords: ['living', 'saloon', 'lounge', 'hall', 'معيشة', 'معيشه', 'صالة', 'صاله', 'مجلس'] },
      { icon: 'building', keywords: ['balcony', 'terrace', 'شرفة', 'شرفه', 'بلكونة', 'بلكونه', 'تراس'] }
    ], 'home');
  }

  getFacilityIcon(facilityTypeName: string): string {
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

  getServiceIcon(serviceTypeNameKey: string): string {
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
      { icon: 'door-exit', keywords: ['checkout', 'check-out', 'خروج', 'تسجيل مغادرة', 'تسجيل مغادره'] }
    ], 'settings');
  }

  private mapRooms(rooms: UnitBasicDataRoom[]): UnitRoomSection[] {
    return rooms.map(room => {
      const bedBadge = room.beds.length > 0
        ? room.beds.map(b => `${b.quantity}× ${b.bedTypeName}`).join(', ')
        : undefined;

      const amenities: UnitAmenityItem[] = room.facilities.map(f => ({
        icon:  this.getFacilityIcon(f.facilityTypeName),
        label: f.facilityTypeName
      }));

      const services: UnitAmenityItem[] = room.services.map(s => ({
        icon:  this.getServiceIcon(s.serviceTypeNameKey),
        label: this.getServiceLabel(s)
      }));

      const subAreas: UnitSubArea[] = room.subRooms.map(sr => ({
        label:     sr.subRoomTypeName,
        amenities: sr.facilities.map(f => ({ icon: this.getFacilityIcon(f.facilityTypeName), label: f.facilityTypeName })),
        services:  sr.services.map(s  => ({ icon: this.getServiceIcon(s.serviceTypeNameKey),  label: this.getServiceLabel(s) }))
      }));

      return {
        icon:    this.getRoomIcon(room.roomTypeName),
        title:   room.roomTypeName,
        desc:    bedBadge ?? '',
        badge:   bedBadge,
        amenities,
        services,
        subAreas,
        isOpen:  true
      };
    });
  }
}
