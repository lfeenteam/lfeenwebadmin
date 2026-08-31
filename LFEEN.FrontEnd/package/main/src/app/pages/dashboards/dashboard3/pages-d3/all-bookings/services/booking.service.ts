import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Booking, BookingActivityLogApiItem, BookingApiItem, BookingDetailApiItem, BookingFinancialSummary, BookingListResponse, BookingQueryParams, BookingServiceRequestListResponse, BookingStatus, BookingUnitOption } from '../interfaces/booking.model';
import { PaginatedUnitResponse } from '../../../interfaces/unit-card.model';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { formatNaiveDayMonth } from 'src/app/utils/date-format.util';

const BOOKING_STATUS_LABEL_KEY: Record<BookingStatus, string> = {
  blocked:           'd3.bookings.status.blocked',
  cancelled:         'd3.bookings.status.cancelled',
  expired:           'd3.bookings.status.expired',
  no_show:           'd3.bookings.status.noShow',
  completed:         'd3.bookings.status.completed',
  awaiting_checkout: 'd3.bookings.status.awaitingCheckout',
  checked_in:        'd3.bookings.status.checkedIn',
  awaiting_checkin:  'd3.bookings.status.awaitingCheckin',
  awaiting_ack:      'd3.bookings.status.awaitingAck',
  confirmed:         'd3.bookings.status.confirmed',
  pending:           'd3.bookings.status.pending',
  on_hold:           'd3.bookings.status.onHold',
  unconfirmed:       'd3.bookings.status.unconfirmed',
  unknown:           'd3.bookings.status.unknown',
};

// Statuses where an admin may still move the booking to another unit or cancel it.
const MODIFIABLE_STATUSES: ReadonlySet<BookingStatus> = new Set<BookingStatus>(['confirmed', 'on_hold']);

@Injectable({ providedIn: 'root' })
export class BookingService {
  private http = inject(HttpClient);
  private translate = inject(TranslateService);

  getBookings(params: BookingQueryParams = {}): Observable<BookingListResponse> {
    let httpParams = new HttpParams()
      .set('pageNumber', (params.pageNumber ?? 1).toString())
      .set('pageSize', (params.pageSize ?? 10).toString());

    if (params.checkInDate)  httpParams = httpParams.set('checkInDate', `${params.checkInDate}T00:00:00Z`);
    if (params.checkOutDate) httpParams = httpParams.set('checkOutDate', `${params.checkOutDate}T00:00:00Z`);
    if (params.status)       httpParams = httpParams.set('status', params.status);
    if (params.origin)       httpParams = httpParams.set('origin', params.origin);
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
      .set('pageSize', '500')
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

  mapApiItemToBooking(item: BookingApiItem, lang: string): Booking {
    const customerName = item.customerName?.trim() || '-';
    const checkIn = item.checkIn ? new Date(item.checkIn) : null;
    const checkOut = item.checkOut ? new Date(item.checkOut) : null;
    const amount = item.amount ?? 0;
    const status = this.mapStatus(item.displayStatusKey);
    const isClientPortalBooking = item.isClientPortalBooking ?? false;

    return {
      id: item.bookingId,
      bookingNumber: item.bookingNumber || '-',
      client: {
        name: customerName,
        phone: item.customerPhone?.trim() || '-',
        initials: this.getInitials(customerName),
        colorIndex: this.colorIndexForId(item.bookingId),
      },
      unit: {
        id: item.unitId,
        name: item.unitName?.trim() || '-',
        property: item.propertyName?.trim() || '-',
        location: item.city?.trim() || '-',
      },
      checkIn,
      checkOut,
      amount,
      status,
      isClientPortalBooking,
      checkInLabel: formatNaiveDayMonth(checkIn, lang),
      checkOutLabel: formatNaiveDayMonth(checkOut, lang),
      amountLabel: formatLocalizedNumber(amount, lang),
      statusLabel: status ? this.translate.instant(BOOKING_STATUS_LABEL_KEY[status]) : '-',
      canModify: isClientPortalBooking && MODIFIABLE_STATUSES.has(status),
    };
  }

  /** Stable avatar colour bucket (0-4) derived from the booking id, so the same
   *  booking keeps its colour regardless of row position or page. */
  colorIndexForId(id: string | null | undefined): number {
    if (!id) return 0;
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return hash % 5;
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
