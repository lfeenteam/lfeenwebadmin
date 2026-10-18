import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { BanDialogMode, ListingKind } from 'src/app/pages/dashboards/dashboard3/interfaces/listing-ban.model';
import { ListingBanDialogsService } from '../listing-ban-dialogs.service';

/**
 * Shown at the top of a property/unit review page while it's banned: review actions are
 * locked, and the ban itself can be managed (history, edit reason, unban) from here.
 */
@Component({
  selector: 'app-listing-ban-banner',
  standalone: true,
  imports: [TablerIconsModule, TranslateModule, MatTooltipModule],
  templateUrl: './listing-ban-banner.component.html',
  styleUrl: './listing-ban-banner.component.scss'
})
export class ListingBanBannerComponent {
  private translate = inject(TranslateService);
  private dialogs = inject(ListingBanDialogsService);

  @Input({ required: true }) kind!: ListingKind;
  @Input({ required: true }) listingId!: string;
  @Input() listingName = '';
  @Input() banReason: string | null = null;
  @Input() bannedAt: string | null = null;
  /**
   * Units only: banned as a side effect of the property's ban — the reason is edited from
   * the property, and the unit can't be unbanned until the property is.
   */
  @Input() bannedByProperty = false;

  /** Fires after an edit/unban — the page should reload the listing. */
  @Output() changed = new EventEmitter<void>();

  get bannedAtLabel(): string | null {
    return formatApiDateLocal(this.bannedAt, this.translate.currentLang);
  }

  get canManage(): boolean {
    return this.dialogs.canManage(this.kind);
  }

  openHistory(): void {
    this.dialogs.openHistory(this.kind, this.listingId, this.listingName);
  }

  open(mode: BanDialogMode): void {
    this.dialogs
      .openAction(this.kind, this.listingId, mode, { name: this.listingName, currentReason: this.banReason })
      .subscribe(changed => { if (changed) this.changed.emit(); });
  }
}
