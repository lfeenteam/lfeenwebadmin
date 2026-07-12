export type BookingApiStatus =
  | 'Blocked'
  | 'Cancelled'
  | 'Expired'
  | 'NoShow'
  | 'Completed'
  | 'AwaitingCheckOut'
  | 'CheckedIn'
  | 'AwaitingCheckIn'
  | 'AwaitingCustomerAcknowledgement'
  | 'Confirmed'
  | 'Pending'
  | 'OnHold'
  | 'Unconfirmed'
  | 'Unknown';

export type BookingStatus =
  | 'blocked'
  | 'cancelled'
  | 'expired'
  | 'no_show'
  | 'completed'
  | 'awaiting_checkout'
  | 'checked_in'
  | 'awaiting_checkin'
  | 'awaiting_ack'
  | 'confirmed'
  | 'pending'
  | 'on_hold'
  | 'unconfirmed'
  | 'unknown';

export interface Booking {
  id: string;
  bookingNumber: string;
  client: { name: string; phone: string; initials: string; colorIndex: number };
  unit: { name: string; property: string; location: string };
  checkIn: Date | null;
  checkOut: Date | null;
  amount: number;
  status: BookingStatus;
}

export interface BookingApiItem {
  bookingId: string;
  bookingNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  unitId: number | null;
  unitName: string | null;
  propertyId: number | null;
  propertyName: string | null;
  city: string | null;
  checkIn: string | null;
  checkOut: string | null;
  amount: number;
  currencyCode: string | null;
  displayStatus: string;
  displayStatusKey: BookingApiStatus;
  displayStatusLabel: string;
  createdAtUtc: string;
}

export interface BookingStats {
  totalCount: number;
  confirmedCount: number;
  awaitingArrivalCount: number;
  todayRevenue: number;
  todayRevenueCurrencyCode: string;
}

export interface BookingListResponse {
  data: BookingApiItem[];
  totalCount: number;
  page: number;
  nextPage: number | null;
  totalPages: number;
  stats: BookingStats;
}

export interface BookingQueryParams {
  checkInDate?: string;
  checkOutDate?: string;
  status?: BookingApiStatus;
  search?: string;
  pageNumber?: number;
  pageSize?: number;
}

export const BOOKINGS_PAGE_SIZE = 10;

export const BOOKING_STATUS_OPTIONS: { value: BookingApiStatus | 'all'; labelKey: string }[] = [
  { value: 'all',                             labelKey: 'd3.bookings.status.all'          },
  { value: 'Confirmed',                       labelKey: 'd3.bookings.status.confirmed'    },
  { value: 'CheckedIn',                       labelKey: 'd3.bookings.status.checkedIn'    },
  { value: 'AwaitingCheckIn',                 labelKey: 'd3.bookings.status.awaitingCheckin'  },
  { value: 'AwaitingCheckOut',                labelKey: 'd3.bookings.status.awaitingCheckout' },
  { value: 'Completed',                       labelKey: 'd3.bookings.status.completed'    },
  { value: 'Cancelled',                       labelKey: 'd3.bookings.status.cancelled'    },
  { value: 'Pending',                         labelKey: 'd3.bookings.status.pending'      },
  { value: 'Unconfirmed',                     labelKey: 'd3.bookings.status.unconfirmed'  },
  { value: 'OnHold',                          labelKey: 'd3.bookings.status.onHold'       },
  { value: 'AwaitingCustomerAcknowledgement', labelKey: 'd3.bookings.status.awaitingAck'  },
  { value: 'Blocked',                         labelKey: 'd3.bookings.status.blocked'      },
  { value: 'NoShow',                          labelKey: 'd3.bookings.status.noShow'       },
  { value: 'Expired',                         labelKey: 'd3.bookings.status.expired'      },
  { value: 'Unknown',                         labelKey: 'd3.bookings.status.unknown'      },
];
