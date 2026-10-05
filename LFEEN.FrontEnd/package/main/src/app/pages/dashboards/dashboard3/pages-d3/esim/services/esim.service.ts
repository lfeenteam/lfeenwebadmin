import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { EsimDetail, EsimOverview } from '../interfaces/esim.model';

// No backend endpoint exists for eSIM yet — this is the sample data from the design.
// Replace getOverview() / getDetail() with the real HTTP calls once the API ships; the
// components only depend on the EsimOverview / EsimDetail shapes.
const MOCK_OVERVIEW: EsimOverview = {
  summary: {
    totalSales: 18420,
    salesGrowthPercent: 8.4,
    totalUsers: 94,
    newUsers: 18,
    activeSims: 126,
    totalSims: 148,
    newSimsThisMonth: 12,
  },
  items: [
    {
      id: '1', userName: 'أحمد محمد', email: 'ahmed.m@email.com', phone: '+966 55 481 7296',
      purchasedAtUtc: '2025-06-12T09:00:00Z', coverageName: 'السعودية', coverageCode: 'SA', scope: 'Local',
      planType: 'Limited', networkType: '5G', carrier: 'STC', dataGb: 20, validityDays: 30, price: 84,
      status: 'Active', activatedAtUtc: '2025-06-12T09:10:00Z', expiresAtUtc: '2025-07-12T09:10:00Z',
    },
    {
      id: '2', userName: 'سارة خالد', email: 'sarak@email.com', phone: '+971 50 284 6137',
      purchasedAtUtc: '2025-06-18T11:30:00Z', coverageName: 'الإمارات', coverageCode: 'AE', scope: 'Local',
      planType: 'Limited', networkType: '5G', carrier: 'e&', dataGb: 10, validityDays: 15, price: 62.5,
      status: 'Active', activatedAtUtc: '2025-06-18T11:40:00Z', expiresAtUtc: '2025-07-03T11:40:00Z',
    },
    {
      id: '3', userName: 'يوسف علي', email: 'yousef.a@email.com', phone: '+966 54 902 1354',
      purchasedAtUtc: '2025-06-24T14:15:00Z', coverageName: 'دول الخليج', coverageCode: 'GCC', scope: 'Regional',
      planType: 'Limited', networkType: '4G / 5G', carrier: 'شبكات متعددة', dataGb: 25, validityDays: 30, price: 129,
      status: 'Pending', activatedAtUtc: null, expiresAtUtc: null,
    },
    {
      id: '4', userName: 'ريم عبدالله', email: 'reem.a@email.com', phone: '+90 531 384 5076',
      purchasedAtUtc: '2025-04-03T08:20:00Z', coverageName: 'تركيا', coverageCode: 'TR', scope: 'Local',
      planType: 'Limited', networkType: '4G', carrier: 'Turkcell', dataGb: 5, validityDays: 7, price: 42,
      status: 'Expired', activatedAtUtc: '2025-04-03T08:30:00Z', expiresAtUtc: '2025-04-10T08:30:00Z',
    },
    {
      id: '5', userName: 'خالد إبراهيم', email: 'khaled.i@email.com', phone: '+44 7400 294 873',
      purchasedAtUtc: '2025-06-09T16:45:00Z', coverageName: 'أوروبا', coverageCode: 'EU', scope: 'Regional',
      planType: 'Unlimited', networkType: '5G', carrier: '32 شبكة', dataGb: 50, validityDays: 30, price: 218,
      status: 'Active', activatedAtUtc: '2025-06-09T17:00:00Z', expiresAtUtc: '2025-07-09T17:00:00Z',
    },
    {
      id: '6', userName: 'منى حسن', email: 'mona.h@email.com', phone: '+20 100 572 9941',
      purchasedAtUtc: '2025-06-21T10:05:00Z', coverageName: 'عالمي', coverageCode: 'GL', scope: 'Global',
      planType: 'Unlimited', networkType: '4G / 5G', carrier: 'شبكات متعددة', dataGb: 100, validityDays: 30, price: 349,
      status: 'Active', activatedAtUtc: '2025-06-21T10:20:00Z', expiresAtUtc: '2025-07-21T10:20:00Z',
    },
  ],
};

// Fields only the detail view needs, keyed by subscription id.
const MOCK_DETAIL_EXTRAS: Record<string, Pick<EsimDetail, 'simNumber' | 'iccid' | 'usedGb' | 'simsCount'>> = {
  '1': { simNumber: '+966 55 481 7290', iccid: '8966 2400 0192 8473', usedGb: 12.4, simsCount: 2 },
  '2': { simNumber: '+971 50 284 6130', iccid: '8997 1100 4471 2260', usedGb: 3.1, simsCount: 1 },
  '3': { simNumber: '+966 54 902 1350', iccid: '8966 2400 7730 1185', usedGb: 0, simsCount: 1 },
  '4': { simNumber: '+90 531 384 5070', iccid: '8990 0100 5528 9034', usedGb: 5, simsCount: 3 },
  '5': { simNumber: '+44 7400 294 870', iccid: '8944 1000 3316 7742', usedGb: 21.5, simsCount: 1 },
  '6': { simNumber: '+20 100 572 9940', iccid: '8920 0200 9981 4407', usedGb: 38, simsCount: 2 },
};

@Injectable({ providedIn: 'root' })
export class EsimService {
  getOverview(): Observable<EsimOverview> {
    return of(MOCK_OVERVIEW);
  }

  getDetail(id: string): Observable<EsimDetail> {
    const item = MOCK_OVERVIEW.items.find(i => i.id === id);
    const extras = MOCK_DETAIL_EXTRAS[id];
    if (!item || !extras) return throwError(() => new Error('eSIM not found'));
    return of({ ...item, ...extras });
  }
}
