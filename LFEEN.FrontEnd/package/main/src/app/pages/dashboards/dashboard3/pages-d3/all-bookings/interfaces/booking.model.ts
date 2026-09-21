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

export type BookingOrigin = 'ClientPortal' | 'Merchant';

export interface Booking {
  id: string;
  bookingNumber: string;
  client: { name: string; phone: string; initials: string; colorIndex: number };
  unit: { id: number | null; name: string; property: string; location: string };
  checkIn: Date | null;
  checkOut: Date | null;
  amount: number;
  status: BookingStatus;
  isClientPortalBooking: boolean;
  // Precomputed once at map time so the row template holds no method calls.
  checkInLabel: string;
  checkOutLabel: string;
  amountLabel: string;
  statusLabel: string;
  canModify: boolean;
}

export interface BookingUnitOption {
  id: number;
  name: string;
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
  isClientPortalBooking: boolean;
}

export interface BookingCompanion {
  id: string;
  name: string | null;
  phoneNumber: string | null;
  relationshipType: string | null;
}

export interface BookingDetailApiItem {
  bookingId: string;
  bookingNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  companions: BookingCompanion[] | null;
  unitId: number | null;
  unitNumber: string | null;
  unitTypeName: string | null;
  propertyId: number | null;
  propertyName: string | null;
  city: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number | null;
  checkedInAtUtc: string | null;
  checkedOutAtUtc: string | null;
  displayStatus: string;
  displayStatusKey: string;
  displayStatusLabel: string;
  createdAtUtc: string;
}

export interface BookingFinancialSummary {
  bookingId: string;
  bookingNumber: string;
  currencyCode: string;
  pricePerNight: number;
  nights: number;
  totalRentAmount: number;
  paidRentAmount: number;
  remainingRentAmount: number;
  unitHasDeposit: boolean;
  requiredDepositAmount: number;
  paidDepositAmount: number;
  remainingDepositAmount: number;
}

export interface BookingServiceRequestApiItem {
  externalId: string;
  bookingId: string;
  bookingNumber: string;
  requestType: string;
  requestTypeKey: string;
  title: string | null;
  titleAr: string | null;
  titleEn: string | null;
  status: string;
  statusKey: string;
  statusLabel: string;
  pricingStatus: string;
  paymentStatus: string;
  unitTaskType: string | null;
  unitTaskExternalId: string | null;
  description: string | null;
  guestNote: string | null;
  price: number | null;
  currency: string | null;
  priceNote: string | null;
  unitLabel: string | null;
  propertyName: string | null;
  createdAtUtc: string;
  updatedAtUtc: string | null;
  completedAtUtc: string | null;
  rejectionReason: string | null;
  hasProblem: boolean;
  problemDescription: string | null;
  problemReportedAtUtc: string | null;
  isRated: boolean;
  ratingEase: number | null;
  ratingSpeed: number | null;
  ratingStaff: number | null;
  ratingSatisfaction: number | null;
  ratingNotes: string | null;
  ratedAtUtc: string | null;
  overallRating: number | null;
  overallRatingLabel: string | null;
}

export interface BookingServiceRequestListResponse {
  data: BookingServiceRequestApiItem[];
  totalCount: number;
  page: number;
  nextPage: number | null;
  totalPages: number;
}

export type BookingActivityLogSource = 'Admin' | 'Merchant' | 'Guest' | 'System';

export interface BookingActivityLogApiItem {
  actionKey: string;
  label: string;
  actorName: string | null;
  source: BookingActivityLogSource;
  atUtc: string;
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
  origin?: BookingOrigin;
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

export const BOOKING_ORIGIN_OPTIONS: { value: BookingOrigin | 'all'; labelKey: string }[] = [
  { value: 'all',          labelKey: 'd3.bookings.origin.all'          },
  { value: 'ClientPortal', labelKey: 'd3.bookings.origin.clientPortal' },
  { value: 'Merchant',     labelKey: 'd3.bookings.origin.merchant'     },
];
