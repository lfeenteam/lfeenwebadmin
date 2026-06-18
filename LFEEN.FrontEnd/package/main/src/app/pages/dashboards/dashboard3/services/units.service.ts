import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BuildingWithUnits } from '../interfaces/unit-card.model';

export type UnitReviewDecision = 'approved' | 'rejected';

@Injectable({
  providedIn: 'root'
})
export class UnitsService {
  private buildingsWithUnits: BuildingWithUnits[] = [
    {
      id: 'b1',
      name: 'برج ريتاج السكني',
      location: 'جدة، حي الشاطئ',
      publishedUnits: 12,
      image: 'assets/images/products/review_image.png',
      units: [
        {
          id: 'u1',
          unitNumber: '402',
          title: 'دوبلكس ملكي',
          floor: 'الدور ١٢-١٣',
          capacity: 'سعة ٨ أفراد',
          status: 'active',
          type: 'دوبلكس',
          description: '٥ غرف - مسبح',
          rooms: 5,
          area: '٢٢٠ م²',
          hasPool: true,
          cancelPolicyType: 'partial_refund'
        },
        {
          id: 'u2',
          unitNumber: '402',
          title: 'دوبلكس ملكي',
          floor: 'الدور ١٢-١٣',
          capacity: 'سعة ٨ أفراد',
          status: 'active',
          type: 'دوبلكس',
          description: '٥ غرف - مسبح',
          rooms: 5,
          area: '٢٢٠ م²',
          hasPool: true
        },
        {
          id: 'u3',
          unitNumber: '402',
          title: 'دوبلكس ملكي',
          floor: 'الدور ١٢-١٣',
          capacity: 'سعة ٨ أفراد',
          status: 'active',
          type: 'دوبلكس',
          description: '٥ غرف - مسبح',
          rooms: 5,
          area: '٢٢٠ م²',
          hasPool: true
        },
        {
          id: 'u4',
          unitNumber: '101',
          title: 'شقة ديلوكس مطلة',
          floor: 'الدور ٤',
          capacity: 'سعة ٤ أفراد',
          status: 'active',
          type: 'شقة سكنية',
          description: '٣ غرف - صالة',
          rooms: 3,
          area: '١٢٠ م²',
          hasPool: false
        }
      ]
    },
    {
      id: 'b2',
      name: 'برج ريتاج السكني',
      location: 'جدة، حي الشاطئ',
      publishedUnits: 12,
      image: 'assets/images/products/s2.jpg',
      units: [
        {
          id: 'u5',
          unitNumber: '402',
          title: 'دوبلكس ملكي',
          floor: 'الدور ١٢-١٣',
          capacity: 'سعة ٨ أفراد',
          status: 'active',
          type: 'دوبلكس',
          description: '٥ غرف - مسبح',
          rooms: 5,
          area: '٢٢٠ م²',
          hasPool: true
        },
        {
          id: 'u6',
          unitNumber: '402',
          title: 'دوبلكس ملكي',
          floor: 'الدور ١٢-١٣',
          capacity: 'سعة ٨ أفراد',
          status: 'active',
          type: 'دوبلكس',
          description: '٥ غرف - مسبح',
          rooms: 5,
          area: '٢٢٠ م²',
          hasPool: true
        },
        {
          id: 'u7',
          unitNumber: '402',
          title: 'دوبلكس ملكي',
          floor: 'الدور ١٢-١٣',
          capacity: 'سعة ٨ أفراد',
          status: 'active',
          type: 'دوبلكس',
          description: '٥ غرف - مسبح',
          rooms: 5,
          area: '٢٢٠ م²',
          hasPool: true
        },
        {
          id: 'u8',
          unitNumber: '101',
          title: 'شقة ديلوكس مطلة',
          floor: 'الدور ٤',
          capacity: 'سعة ٤ أفراد',
          status: 'active',
          type: 'شقة سكنية',
          description: '٣ غرف - صالة',
          rooms: 3,
          area: '١٢٠ م²',
          hasPool: false
        }
      ]
    },
    {
      id: 'b3',
      name: 'برج ريتاج السكني (قيد المراجعة)',
      location: 'جدة، حي الشاطئ',
      publishedUnits: 0,
      image: 'assets/images/products/review_image.png',
      units: [
        {
          id: 'ur1',
          unitNumber: '301',
          title: 'شقة ديلوكس مطلة',
          floor: 'الدور ٣',
          capacity: 'سعة ٤ أفراد',
          status: 'underReview',
          type: 'شقة سكنية',
          description: '٣ غرف - صالة',
          rooms: 3,
          area: '١٢٠ م²',
          hasPool: false,
          cancelPolicyType: 'non_refundable',
          servicesPricingType: 'paid'
        },
        {
          id: 'ur2',
          unitNumber: '301',
          title: 'شقة ديلوكس مطلة',
          floor: 'الدور ٣',
          capacity: 'سعة ٤ أفراد',
          status: 'underReview',
          type: 'شقة سكنية',
          description: '٣ غرف - صالة',
          rooms: 3,
          area: '١٢٠ م²',
          hasPool: false,
          cancelPolicyType: 'flexible',
          servicesPricingType: 'free'
        },
        {
          id: 'ur3',
          unitNumber: '302',
          title: 'شقة ديلوكس مطلة',
          floor: 'الدور ٣',
          capacity: 'سعة ٤ أفراد',
          status: 'underReview',
          type: 'شقة سكنية',
          description: '٣ غرف - صالة',
          rooms: 3,
          area: '١٢٠ م²',
          hasPool: false,
          cancelPolicyType: 'partial_refund',
          servicesPricingType: 'paid'
        }
      ]
    },
    {
      id: 'b4',
      name: 'أجنحة المروج الفندقية',
      location: 'مكة المكرمة، حي العزيزية',
      publishedUnits: 0,
      image: 'assets/images/products/review_image.png',
      needsPropertyReview: true,
      units: [
        {
          id: 's1',
          unitNumber: 'A1',
          title: 'جناح المروج الملكي',
          floor: 'سعة ٣ أفراد',
          capacity: '',
          status: 'stopped',
          type: 'جناح',
          description: 'غرفتين - صالة',
          rooms: 2,
          area: '٩٥ م²',
          hasPool: false
        }
      ]
    }
  ];

  private buildingsSubject = new BehaviorSubject<BuildingWithUnits[]>(this.buildingsWithUnits);
  private reviewDecisionsSubject = new BehaviorSubject<Record<string, UnitReviewDecision>>({});

  getBuildingsWithUnits(): Observable<BuildingWithUnits[]> {
    return this.buildingsSubject.asObservable();
  }

  getReviewDecisions(): Observable<Record<string, UnitReviewDecision>> {
    return this.reviewDecisionsSubject.asObservable();
  }

  setReviewDecision(buildingId: string, unitId: string, sectionKey: string, decision: UnitReviewDecision): void {
    const key = this.getReviewDecisionKey(buildingId, unitId, sectionKey);
    this.reviewDecisionsSubject.next({
      ...this.reviewDecisionsSubject.value,
      [key]: decision
    });
  }

  getReviewDecision(buildingId: string, unitId: string, sectionKey: string): UnitReviewDecision | undefined {
    return this.reviewDecisionsSubject.value[this.getReviewDecisionKey(buildingId, unitId, sectionKey)];
  }

  private getReviewDecisionKey(buildingId: string, unitId: string, sectionKey: string): string {
    return `${buildingId}:${unitId}:${sectionKey}`;
  }
}
