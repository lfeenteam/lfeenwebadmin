import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { ListingBanService } from 'src/app/pages/dashboards/dashboard3/services/listing-ban.service';
import {
  BAN_REASON_MAX_LENGTH,
  BanDialogMode,
  ListingBanResult,
  ListingKind,
} from 'src/app/pages/dashboards/dashboard3/interfaces/listing-ban.model';

export interface BanListingDialogData {
  kind: ListingKind;
  id: string;
  name?: string;
  /** Defaults to 'ban'. */
  mode?: BanDialogMode;
  /** Pre-fills the textarea in 'editReason' mode. */
  currentReason?: string | null;
}

/**
 * Closes with the API result on success, or 'refresh' when the backend says the
 * listing's state has moved on (already banned / not banned / deleted) so the list is stale.
 */
export type BanListingDialogResult = ListingBanResult | 'refresh' | undefined;

// errorCode → translation key; `refresh` = the list no longer reflects the listing's real state.
const ERROR_MAP: Record<string, { key: string; refresh?: boolean }> = {
  CANNOT_BAN_IN_CURRENT_STATUS: { key: 'd3.listingBan.errors.cannotBan', refresh: true },
  NOT_BANNED:                   { key: 'd3.listingBan.errors.notBanned', refresh: true },
  PARENT_PROPERTY_BANNED:       { key: 'd3.listingBan.errors.parentPropertyBanned' },
  BANNED_BY_PROPERTY:           { key: 'd3.listingBan.errors.bannedByProperty' },
  REASON_REQUIRED:              { key: 'd3.listingBan.errors.reasonRequired' },
  ADMIN_PROPERTY_NOT_FOUND:     { key: 'd3.listingBan.errors.notFound', refresh: true },
  UNIT_NOT_FOUND:               { key: 'd3.listingBan.errors.notFound', refresh: true },
  FORBIDDEN:                    { key: 'd3.listingBan.errors.forbidden' },
};

@Component({
  selector: 'app-ban-listing-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './ban-listing-dialog.component.html',
  styleUrl: './ban-listing-dialog.component.scss'
})
export class BanListingDialogComponent {
  private dialogRef = inject(MatDialogRef<BanListingDialogComponent, BanListingDialogResult>);
  readonly data = inject<BanListingDialogData>(MAT_DIALOG_DATA);
  private translate = inject(TranslateService);
  private banService = inject(ListingBanService);
  private toastr = inject(ToastrService);

  readonly maxLength = BAN_REASON_MAX_LENGTH;
  readonly mode: BanDialogMode = this.data.mode ?? 'ban';
  reason = this.mode === 'editReason' ? (this.data.currentReason ?? '') : '';
  submitting = false;

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get isProperty(): boolean {
    return this.data.kind === 'property';
  }

  get needsReason(): boolean {
    return this.mode !== 'unban';
  }

  /** e.g. d3.listingBan.dialog.ban.titleProperty */
  key(name: string): string {
    const suffix = this.isProperty ? 'Property' : 'Unit';
    return `d3.listingBan.dialog.${this.mode}.${name}${suffix}`;
  }

  get canSubmit(): boolean {
    if (this.submitting) return false;
    if (!this.needsReason) return true;
    const trimmed = this.reason.trim();
    return trimmed.length > 0
      && trimmed.length <= this.maxLength
      && !(this.mode === 'editReason' && trimmed === (this.data.currentReason ?? '').trim());
  }

  close(result?: BanListingDialogResult): void {
    this.dialogRef.close(result);
  }

  confirm(): void {
    if (!this.canSubmit) return;
    this.submitting = true;
    // Never auto-retry: a timed-out request may still have gone through.
    this.dialogRef.disableClose = true;

    this.request().subscribe({
      next: result => {
        this.toastr.success(this.successMessage(result));
        this.close(result);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting = false;
        this.dialogRef.disableClose = false;
        this.handleError(err);
      },
    });
  }

  private request(): Observable<ListingBanResult> {
    const { kind, id } = this.data;
    switch (this.mode) {
      case 'ban':        return this.banService.ban(kind, id, this.reason.trim());
      case 'editReason': return this.banService.updateReason(kind, id, this.reason.trim());
      case 'unban':      return this.banService.unban(kind, id);
    }
  }

  // "Banned · 2 bookings cancelled · 3 units banned" — each count is only mentioned when it's non-zero.
  private successMessage(result: ListingBanResult): string {
    const base = `d3.listingBan.dialog.${this.mode}`;
    const parts = [this.translate.instant(`${base}.success`)];

    const bookings = result.cancelledBookingsCount ?? 0;
    if (this.mode === 'ban' && bookings > 0) {
      parts.push(this.translate.instant(`${base}.bookingsDetail`, { count: bookings }));
    }

    const units = result.affectedUnitsCount ?? 0;
    if (this.isProperty && units > 0) {
      parts.push(this.translate.instant(`${base}.unitsDetail`, { count: units }));
    }

    return parts.join(' · ');
  }

  private handleError(err: HttpErrorResponse): void {
    const body = err?.error;
    const mapped = ERROR_MAP[body?.errorCode ?? ''];

    if (mapped) {
      this.toastr.error(this.translate.instant(mapped.key));
      if (mapped.refresh) this.close('refresh');
      return;
    }

    // Our own validation errors come back localized (Accept-Language), so show them as-is.
    const validationMessage: string | undefined = body?.errors?.[0]?.message;
    if (err.status === 400 && validationMessage) {
      this.toastr.error(validationMessage);
      return;
    }

    const key = err.status === 403
      ? 'd3.listingBan.errors.forbidden'
      : err.status === 0 || err.status >= 500
        ? 'd3.listingBan.errors.serviceUnavailable'
        : 'd3.toast.errorOp';
    this.toastr.error(this.translate.instant(key));
  }
}
