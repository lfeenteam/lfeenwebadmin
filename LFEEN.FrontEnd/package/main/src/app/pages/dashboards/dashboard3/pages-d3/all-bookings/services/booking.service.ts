import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Booking, BookingApiItem, BookingListResponse, BookingQueryParams, BookingStatus } from '../interfaces/booking.model';

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

  private mapStatus(status: string): BookingStatus {
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

  private getInitials(name: string): string {
    if (name === '-') return '-';
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase();
  }
}
