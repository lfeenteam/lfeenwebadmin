import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Booking, BookingActivityLogApiItem, BookingApiItem, BookingDetailApiItem, BookingFinancialSummary, BookingListResponse, BookingQueryParams, BookingServiceRequestListResponse, BookingStatus, BookingUnitOption } from '../interfaces/booking.model';
import { PaginatedUnitResponse } from '../../../interfaces/unit-card.model';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private http = inject(HttpClient);

  getBookings(params: BookingQueryParams = {}): Observable<BookingListResponse> {
    let httpParams = new HttpParams()
      .set('pageNumber', (params.pageNumber ?? 1).toString())
      .set('pageSize', (params.pageSize ?? 10).toString());

    if (params.checkInDate)  httpParams = httpParams.set('checkInDate', `${params.checkInDate}T00:00:00Z`);
    if (params.checkOutDate) httpParams = httpParams.set('checkOutDate', `${params.checkOutDate}T00:00:00Z`);
    if (params.status)       httpParams = httpParams.set('status', params.status);
    if (params.search)       httpParams = httpParams.set('search', params.search);

    return this.http.get<BookingListResponse>(`${environment.apiBaseUrl}/api/bookings`, { params: httpParams });
  }

  getBookingDetail(bookingId: string): Observable<BookingDetailApiItem> {
    return this.http.get<BookingDetailApiItem>(`${environment.apiBaseUrl}/api/bookings/${bookingId}`);
  }

  getBookingFinancialSummary(bookingId: string): Observable<BookingFinancialSummary> {
    return this.http.get<BookingFinancialSummary>(`${environment.apiBaseUrl}/api/bookings/${bookingId}/financial-summary`);
  }

  getBookingServiceRequests(bookingId: string, page = 1, pageSize = 50): Observable<BookingServiceRequestListResponse> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<BookingServiceRequestListResponse>(`${environment.apiBaseUrl}/api/bookings/${bookingId}/service-requests`, { params });
  }

  getBookingActivityLog(bookingId: string): Observable<BookingActivityLogApiItem[]> {
    return this.http.get<BookingActivityLogApiItem[]>(`${environment.apiBaseUrl}/api/bookings/${bookingId}/activity-log`);
  }

  /**
   * Units offered when moving a booking to another unit — only published
   * (review status 3 = Approved) units are eligible.
   */
  getPublishedUnits(): Observable<BookingUnitOption[]> {
    const params = new HttpParams()
      .set('pageNumber', '1')
      .set('pageSize', '100')
      .set('status', '3')
      .set('newestFirst', 'true');

    return this.http
      .get<PaginatedUnitResponse>(`${environment.apiBaseUrl}/api/units`, { params })
      .pipe(
        map(res => (res.data ?? []).map(u => ({
          id: u.unitId,
          name: this.buildUnitOptionLabel(u.name, u.unitTypeName, u.apartmentNumberInFloor, u.propertyName),
        })))
      );
  }

  private buildUnitOptionLabel(
    name: string | null,
    unitTypeName: string,
    apartmentNumberInFloor: number,
    propertyName: string,
  ): string {
    const base = name?.trim() || `${unitTypeName} ${apartmentNumberInFloor}`.trim();
    return propertyName?.trim() ? `${base} - ${propertyName.trim()}` : base;
  }

  changeBookingUnit(bookingId: string, newUnitId: number, reason: string): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/api/bookings/${bookingId}/change-unit`, {
      newUnitId,
      reason,
    });
  }

  cancelBooking(bookingId: string, cancellationReason: string): Observable<void> {
    return this.http.post<void>(`${environment.apiBaseUrl}/api/bookings/${bookingId}/cancel`, {
      cancellationReason,
    });
  }

  mapApiItemToBooking(item: BookingApiItem, colorIndex: number): Booking {
    const customerName = item.customerName?.trim() || '-';
    return {
      id: item.bookingId,
      bookingNumber: item.bookingNumber || '-',
      client: {
        name: customerName,
        phone: item.customerPhone?.trim() || '-',
        initials: this.getInitials(customerName),
        colorIndex,
      },
      unit: {
        id: item.unitId,
        name: item.unitName?.trim() || '-',
        property: item.propertyName?.trim() || '-',
        location: item.city?.trim() || '-',
      },
      checkIn: item.checkIn ? new Date(item.checkIn) : null,
      checkOut: item.checkOut ? new Date(item.checkOut) : null,
      amount: item.amount ?? 0,
      status: this.mapStatus(item.displayStatusKey),
    };
  }

  private static readonly KNOWN_STATUSES: BookingStatus[] = [
    'blocked', 'cancelled', 'expired', 'no_show', 'completed', 'awaiting_checkout',
    'checked_in', 'awaiting_checkin', 'awaiting_ack', 'confirmed', 'pending',
    'on_hold', 'unconfirmed', 'unknown',
  ];

  mapStatus(status: string | null | undefined): BookingStatus {
    if (!status) return 'unknown';
    if (BookingService.KNOWN_STATUSES.includes(status as BookingStatus)) {
      return status as BookingStatus;
    }
    const map: Record<string, BookingStatus> = {
      Blocked: 'blocked',
      Cancelled: 'cancelled',
      Expired: 'expired',
      NoShow: 'no_show',
      Completed: 'completed',
      AwaitingCheckOut: 'awaiting_checkout',
      CheckedIn: 'checked_in',
      AwaitingCheckIn: 'awaiting_checkin',
      AwaitingCustomerAcknowledgement: 'awaiting_ack',
      Confirmed: 'confirmed',
      Pending: 'pending',
      OnHold: 'on_hold',
      Unconfirmed: 'unconfirmed',
      Unknown: 'unknown',
    };
    return map[status] ?? 'unknown';
  }

  getInitials(name: string | null | undefined): string {
    if (!name?.trim()) return '-';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase();
  }
}
