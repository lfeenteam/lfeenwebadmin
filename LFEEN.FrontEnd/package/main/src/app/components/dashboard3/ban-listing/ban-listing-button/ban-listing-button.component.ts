import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { ListingKind } from 'src/app/pages/dashboards/dashboard3/interfaces/listing-ban.model';
import { ListingBanDialogsService } from '../listing-ban-dialogs.service';

/**
 * Ban icon for a property/unit card. Renders nothing unless the admin holds the
 * matching *.Ban permission; the card decides whether the listing's status allows it.
 */
@Component({
  selector: 'app-ban-listing-button',
  standalone: true,
  imports: [TablerIconsModule, TranslateModule, MatTooltipModule],
  templateUrl: './ban-listing-button.component.html',
  styleUrl: './ban-listing-button.component.scss'
})
export class BanListingButtonComponent {
  private dialogs = inject(ListingBanDialogsService);

  @Input({ required: true }) kind!: ListingKind;
  @Input({ required: true }) listingId!: string;
  @Input() listingName = '';
  @Input() size: 'md' | 'sm' = 'md';

  /** Fires after a successful ban, or when the list turned out to be stale — the parent should reload. */
  @Output() changed = new EventEmitter<void>();

  get hasPermission(): boolean {
    return this.dialogs.canManage(this.kind);
  }

  open(event: Event): void {
    // Cards are clickable themselves (they navigate to the review page).
    event.stopPropagation();
    this.dialogs
      .openAction(this.kind, this.listingId, 'ban', { name: this.listingName })
      .subscribe(changed => { if (changed) this.changed.emit(); });
  }
}
