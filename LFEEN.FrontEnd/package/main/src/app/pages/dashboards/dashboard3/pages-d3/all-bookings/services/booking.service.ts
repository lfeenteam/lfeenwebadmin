import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Booking, BookingActivityLogApiItem, BookingApiItem, BookingDetailApiItem, BookingFinancialSummary, BookingListResponse, BookingQueryParams, BookingServiceRequestListResponse, BookingStatus } from '../interfaces/booking.model';

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
