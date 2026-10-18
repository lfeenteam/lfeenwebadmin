import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, map } from 'rxjs';
import { LoginService } from 'src/app/pages/dashboards/dashboard3/services/login/login.service';
import { BanDialogMode, ListingKind } from 'src/app/pages/dashboards/dashboard3/interfaces/listing-ban.model';
import {
  BanListingDialogComponent,
  BanListingDialogData,
  BanListingDialogResult,
} from './ban-listing-dialog/ban-listing-dialog.component';
import { BanHistoryDialogComponent, BanHistoryDialogData } from './ban-history-dialog/ban-history-dialog.component';

/** Opens the ban dialogs the same way from cards, the ban icon and the review pages. */
@Injectable({ providedIn: 'root' })
export class ListingBanDialogsService {
  private dialog = inject(MatDialog);
  private login = inject(LoginService);

  /** Properties.Ban / Units.Ban — gates ban, edit-reason and unban. */
  canManage(kind: ListingKind): boolean {
    const required = kind === 'property' ? 'properties.ban' : 'units.ban';
    return this.login.permissions().some(p => p.toLowerCase() === required);
  }

  /**
   * Emits true when the caller should reload: the action succeeded, or the backend
   * reported the listing's state had already moved on.
   */
  openAction(
    kind: ListingKind,
    id: string,
    mode: BanDialogMode,
    options: { name?: string; currentReason?: string | null } = {},
  ): Observable<boolean> {
    return this.dialog
      .open<BanListingDialogComponent, BanListingDialogData, BanListingDialogResult>(BanListingDialogComponent, {
        width: '480px',
        maxWidth: '95vw',
        panelClass: 'ban-listing-dialog-panel',
        autoFocus: mode === 'unban' ? 'dialog' : 'textarea',
        data: { kind, id, mode, name: options.name, currentReason: options.currentReason },
      })
      .afterClosed()
      .pipe(map(result => !!result));
  }

  openHistory(kind: ListingKind, id: string, name?: string): void {
    this.dialog.open<BanHistoryDialogComponent, BanHistoryDialogData>(BanHistoryDialogComponent, {
      width: '560px',
      maxWidth: '95vw',
      panelClass: 'ban-history-dialog-panel',
      data: { kind, id, name },
    });
  }
}
