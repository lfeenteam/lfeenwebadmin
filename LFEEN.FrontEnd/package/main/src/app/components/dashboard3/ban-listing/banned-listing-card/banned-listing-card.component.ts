import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { BanDialogMode, ListingKind } from 'src/app/pages/dashboards/dashboard3/interfaces/listing-ban.model';
import { ListingBanDialogsService } from '../listing-ban-dialogs.service';

/** Card for the "banned" tab of buildings and units: ban date, reason, edit-reason and unban actions. */
@Component({
  selector: 'app-banned-listing-card',
  standalone: true,
  imports: [TablerIconsModule, TranslateModule, MatTooltipModule],
  templateUrl: './banned-listing-card.component.html',
  styleUrl: './banned-listing-card.component.scss'
})
export class BannedListingCardComponent {
  private dialogs = inject(ListingBanDialogsService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @Input({ required: true }) kind!: ListingKind;
  @Input({ required: true }) listingId!: string;
  @Input({ required: true }) title!: string;
  @Input() subtitle = '';
  @Input() bannedAt: string | null = null;
  @Input() banReason: string | null = null;
  /** Units only: banned as a side effect of the property's ban — the reason is edited from the property. */
  @Input() bannedByProperty = false;
  /** Units only: the parent property is banned — the unit can't be unbanned on its own. */
  @Input() propertyBanned = false;
  /** Units only: where "edit from the building" links to. */
  @Input() propertyId: string | null = null;

  /** Fires after an edit/unban, or when the list turned out to be stale — the parent should reload. */
  @Output() changed = new EventEmitter<void>();

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get canManage(): boolean {
    return this.dialogs.canManage(this.kind);
  }

  get bannedAtLabel(): string {
    return formatApiDateLocal(this.bannedAt, this.translate.currentLang) ?? '—';
  }

  /** Opens the listing's review page read-only — same routes the other building/unit cards use. */
  openDetails(): void {
    if (this.kind === 'property') {
      this.navigateToProperty(this.listingId);
      return;
    }
    if (!this.propertyId) return;
    this.router.navigate(['../unit-review', this.propertyId, this.listingId], {
      relativeTo: this.route,
      queryParams: { mode: 'view' },
    });
  }

  goToProperty(event: Event): void {
    event.stopPropagation();
    if (this.propertyId) this.navigateToProperty(this.propertyId);
  }

  private navigateToProperty(id: string): void {
    this.router.navigate(['../build-review', id], {
      relativeTo: this.route,
      queryParams: { mode: 'view' },
    });
  }

  openHistory(event: Event): void {
    event.stopPropagation();
    this.dialogs.openHistory(this.kind, this.listingId, this.title);
  }

  open(mode: BanDialogMode, event: Event): void {
    // The card itself is clickable (opens the details page).
    event.stopPropagation();
    this.dialogs
      .openAction(this.kind, this.listingId, mode, { name: this.title, currentReason: this.banReason })
      .subscribe(changed => { if (changed) this.changed.emit(); });
  }
}
