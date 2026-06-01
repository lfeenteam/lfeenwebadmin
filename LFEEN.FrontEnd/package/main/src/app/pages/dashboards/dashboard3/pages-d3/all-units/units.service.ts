import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { BuildingWithUnits } from './unit-card.model';

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
          hasPool: true
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
          hasPool: false
        }
      ]
    },
    {
      id: 'b2',
      name: 'برج ريتاج السكني',
      location: 'جدة، حي الشاطئ',
      publishedUnits: 12,
      image: 'assets/images/products/s2.jpg', // Placeholder
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
          hasPool: false
        }
      ]
    }
  ];

  private buildingsSubject = new BehaviorSubject<BuildingWithUnits[]>(this.buildingsWithUnits);

  getBuildingsWithUnits(): Observable<BuildingWithUnits[]> {
    return this.buildingsSubject.asObservable();
  }
}
