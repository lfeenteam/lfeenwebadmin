import { AfterViewInit, Component, DestroyRef, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import {
  BuildingReviewInfo,
  LocationReviewPayload,
  LocationReviewResponse,
  PropertyLocationResponse
} from '../../../interfaces/building-card.model';
import { ReviewConfirmDialogComponent } from '../review-confirm-dialog/review-confirm-dialog.component';
import { BuildingReviewService } from '../../../services/building-review.service';
import { GoogleMapsLoaderService } from 'src/app/services/google-maps-loader.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReviewEmptyStateComponent } from 'src/app/components/dashboard3/review-empty-state/review-empty-state.component';

export interface PropertyLocationAddressRow {
  label: string;
  value: string;
  icon: string;
}

export interface PropertyLocationReviewVM {
  propertyId: number;
  decision: string;
  addressRows: PropertyLocationAddressRow[];
  fullAddress: string;
  accessDescription: string;
  latitude: number;
  longitude: number;
  coordinatesText: string;
  googleMapsLink: string;
  rejectionReason: string | null;
}

@Component({
  selector: 'app-review-location',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, ReviewEmptyStateComponent],
  templateUrl: './review-location.component.html',
  styleUrl: './review-location.component.scss'
})
export class ReviewLocationComponent implements OnInit, AfterViewInit {
  @Input() building!: BuildingReviewInfo;
  @Input() propertyId = '';
  @Input() readOnly = false;
  @Output() back = new EventEmitter<void>();
  @Output() approve = new EventEmitter<LocationReviewResponse>();

  @ViewChild('mapContainer') private mapContainerRef?: ElementRef<HTMLDivElement>;

  private buildingService = inject(BuildingReviewService);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private dialog = inject(MatDialog);
  private mapsLoader = inject(GoogleMapsLoaderService);
  private destroyRef = inject(DestroyRef);

  private location: PropertyLocationResponse | null = null;
  private map: any = null;
  private marker: any = null;
  private viewReady = false;

  isLoading = false;
  isSubmitting = false;
  isMapLoading = false;
  mapError = false;
  mapReady = false;
  rejectionReason = '';

  ngOnInit(): void {
    // The backend localizes city/district/formattedAddress etc. based on the
    // Accept-Language header (set from the current language at request time), so
    // a language toggle needs a fresh fetch — the strings won't retranslate on their own.
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadLocation());

    this.loadLocation();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.tryInitMap();
  }
  get hasLocationData(): boolean {
    if (!this.location) return false;
    const l = this.location;
    const hasCoords = !!(l.latitude && l.longitude);
    const hasAddress = !!(l.city || l.region || l.district || l.streetName || l.formattedAddress);
    return hasCoords || hasAddress;
  }

  get vm(): PropertyLocationReviewVM | null {
    if (!this.location) return null;
    const data = this.location;
    const lat = data.latitude;
    const lng = data.longitude;

    return {
      propertyId: data.propertyId,
      decision: data.decision,
      addressRows: [
        {
          label: this.translate.instant('d3.buildReview.location.cityLabel'),
          value: data.city || data.region || '-',
          icon: 'building'
        },
        {
          label: this.translate.instant('d3.buildReview.location.districtLabel'),
          value: data.district || '-',
          icon: 'map-2'
        },
        {
          label: this.translate.instant('d3.buildReview.location.streetLabel'),
          value: data.streetName || '-',
          icon: 'road'
        }
      ],
      fullAddress: data.formattedAddress || '-',
      accessDescription: data.accessDescription || '-',
      latitude: lat,
      longitude: lng,
      coordinatesText: `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`,
      googleMapsLink: data.googleMapsUrl?.trim()
        ? data.googleMapsUrl
        : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      rejectionReason: data.rejectionReason
    };
  }

  private loadLocation(): void {
    if (!this.propertyId) return;

    this.isLoading = true;
    this.buildingService.getPropertyLocation(this.propertyId).subscribe({
      next: (data) => {
        this.isLoading = false;
        this.location = data;
        this.rejectionReason = data.rejectionReason ?? '';
        this.tryInitMap();
      },
      error: () => {
        this.isLoading = false;
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
      }
    });
  }

  private tryInitMap(): void {
    if (!this.viewReady || !this.mapContainerRef || !this.hasLocationData || !this.vm || this.map) return;

    this.isMapLoading = true;
    this.mapError = false;
    this.mapsLoader.load().then(() => {
      this.isMapLoading = false;
      this.renderMap();
    }).catch(() => {
      this.isMapLoading = false;
      this.mapError = true;
    });
  }

  private renderMap(): void {
    const vm = this.vm;
    const google = (window as any).google;
    if (!vm || !this.mapContainerRef || !google?.maps) return;

    const center = { lat: vm.latitude, lng: vm.longitude };
    this.map = new google.maps.Map(this.mapContainerRef.nativeElement, {
      center,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: false,
      clickableIcons: false
    });

    this.marker = new google.maps.Marker({
      position: center,
      map: this.map,
      icon: this.buildMarkerIcon(google),
      optimized: false
    });

    this.mapReady = true;
  }

  // A plain circle-marker svg pin instead of Google's default red teardrop, drawn as a
  // data-uri so no extra asset/network round trip is needed.
  private buildMarkerIcon(google: any): any {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="46" fill="#111110" opacity="0.08"/>
        <circle cx="60" cy="60" r="46" fill="none" stroke="#111110" stroke-opacity="0.12" stroke-width="1"/>
        <rect x="38" y="38" width="44" height="44" rx="14" fill="#141414" stroke="#ffffff" stroke-width="2"/>
        <path fill="#ffffff" transform="translate(48 48)" d="M12 2c4.418 0 8 3.358 8 7.5c0 3.038 -1.998 6.706 -5.997 11.007a2.13 2.13 0 0 1 -3.001 .003c-4.002 -4.304 -6.002 -7.973 -6.002 -11.01c0 -4.142 3.582 -7.5 8 -7.5zM12 6a3 3 0 1 0 0 6a3 3 0 0 0 0 -6z"/>
      </svg>`;

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(120, 120),
      anchor: new google.maps.Point(60, 60)
    };
  }

  zoomIn(): void {
    if (!this.map) return;
    this.map.setZoom((this.map.getZoom() ?? 15) + 1);
  }

  zoomOut(): void {
    if (!this.map) return;
    this.map.setZoom((this.map.getZoom() ?? 15) - 1);
  }

  recenter(): void {
    const vm = this.vm;
    if (!this.map || !vm) return;
    this.map.setCenter({ lat: vm.latitude, lng: vm.longitude });
    this.map.setZoom(15);
  }

  confirmDecision(decision: 'Approved' | 'Rejected'): void {
    if (this.isLoading || this.isSubmitting) return;

    const reason = this.rejectionReason.trim();
    if (decision === 'Rejected' && !reason) {
      this.toastr.warning(this.translate.instant('d3.buildReview.location.rejectionReasonRequired'));
      return;
    }

    const dialogRef = this.dialog.open(ReviewConfirmDialogComponent, {
      width: '440px',
      maxWidth: '92vw',
      panelClass: 'review-confirm-panel',
      data: {
        titleKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.locationRejectTitle'
          : 'd3.buildReview.confirm.locationApproveTitle',
        messageKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.locationRejectMessage'
          : 'd3.buildReview.confirm.locationApproveMessage',
        confirmKey: decision === 'Rejected'
          ? 'd3.buildReview.confirm.rejectAction'
          : 'd3.buildReview.confirm.approveAction',
        tone: decision === 'Rejected' ? 'reject' : 'approve'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) this.submitDecision(decision);
    });
  }

  private submitDecision(decision: 'Approved' | 'Rejected'): void {
    if (!this.propertyId || this.isSubmitting) return;

    const payload: LocationReviewPayload = {
      decision: decision === 'Rejected' ? '2' : '1',
      rejectionReason: decision === 'Rejected' ? this.rejectionReason.trim() : null
    };

    this.isSubmitting = true;
    this.buildingService.submitLocationReview(this.propertyId, payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        const messageKey = response.decision === 'Rejected'
          ? 'd3.buildReview.location.rejectSuccess'
          : 'd3.buildReview.location.approveSuccess';
        this.toastr.success(this.translate.instant(messageKey));
        this.approve.emit(response);
      },
      error: (err) => {
        this.isSubmitting = false;
        const errorCode = err?.error?.code ?? err?.error?.errorCode;
        const messageKey = errorCode === 'REJECTION_REASON_REQUIRED'
          ? 'd3.buildReview.location.rejectionReasonRequired'
          : 'd3.toast.errorOp';
        this.toastr.error(this.translate.instant(messageKey));
      }
    });
  }
}
