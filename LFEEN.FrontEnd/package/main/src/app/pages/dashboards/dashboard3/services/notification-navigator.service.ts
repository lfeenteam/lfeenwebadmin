import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map } from 'rxjs';
import { CoreService } from 'src/app/services/core.service';
import { AdminNotificationsStore } from './admin-notifications-store.service';
import { UnitsService } from './units.service';
import { BuildingReviewService } from './building-review.service';
import { AdminNotification } from '../interfaces/admin-notification.model';
import {
  NotificationDestination,
  REFERENCE_RESOLVED_TYPES,
  routeFor,
  unitReviewDestination,
} from '../pages-d3/notifications/notification-presentation';

/**
 * Opens a notification's target — shared by the notifications page and the header's
 * notifications dropdown so both behave the same: mark as read (fire-and-forget), then
 * navigate; property/unit notifications carry a GUID that is resolved to the numeric
 * review route first, falling back to their list page when the lookup fails.
 */
@Injectable({ providedIn: 'root' })
export class NotificationNavigator {
  private readonly store = inject(AdminNotificationsStore);
  private readonly router = inject(Router);
  private readonly settings = inject(CoreService);
  private readonly unitsService = inject(UnitsService);
  private readonly buildingService = inject(BuildingReviewService);

  private readonly lang = computed(() => this.settings.getOptionsSignal()().language);

  /** The notification whose unit/property is being looked up before navigating. */
  readonly openingId = signal<string | null>(null);

  /** Resolves true once navigation has been started (false: no destination / busy). */
  open(item: AdminNotification, onNavigate?: () => void): boolean {
    // A unit/property lookup is in flight — ignore further clicks until it lands.
    if (this.openingId()) return false;
    // Fire-and-forget: a failed mark-as-read must not block navigation.
    this.store.markAsRead(item.id);
    const fallback = routeFor(item);
    if (!fallback) return false;

    const lookup = this.resolveDestination(item);
    if (!lookup) {
      this.navigate(fallback);
      onNavigate?.();
      return true;
    }
    this.openingId.set(item.id);
    lookup.subscribe({
      next: destination => { this.openingId.set(null); this.navigate(destination); onNavigate?.(); },
      // Deleted or unreachable listing: land on its list rather than an empty review page.
      error: () => { this.openingId.set(null); this.navigate(fallback); onNavigate?.(); },
    });
    return true;
  }

  hasDestination(item: AdminNotification): boolean {
    return routeFor(item) !== null;
  }

  // The notification carries the listing's GUID; the review pages (and every section and
  // decision call they make) need the numeric ids, which the GUID lookup returns.
  private resolveDestination(item: AdminNotification): Observable<NotificationDestination> | null {
    const id = item.referenceId;
    if (!id || !item.referenceType || !REFERENCE_RESOLVED_TYPES.has(item.referenceType)) return null;
    if (item.referenceType === 'Unit') {
      return this.unitsService.getUnitById(id).pipe(map(unit => unitReviewDestination(unit)));
    }
    return this.buildingService.getPropertyById(id).pipe(
      map(property => ({ commands: ['build-review', String(property.propertyId)] })),
    );
  }

  private navigate(destination: NotificationDestination): void {
    this.router.navigate([`/${this.lang()}`, 'd3', ...destination.commands], {
      queryParams: destination.queryParams,
    });
  }
}
