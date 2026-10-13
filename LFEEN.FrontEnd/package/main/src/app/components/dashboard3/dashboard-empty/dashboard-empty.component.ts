import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';

/**
 * - `empty`  — the list has no data at all
 * - `search` — data exists but the current search / filters hide it
 * - `error`  — loading failed (network, forbidden, …)
 */
export type DashboardEmptyVariant = 'empty' | 'search' | 'error';

const DEFAULT_ICONS: Record<DashboardEmptyVariant, string> = {
  empty: 'inbox',
  search: 'search-off',
  error: 'cloud-off',
};

@Component({
  selector: 'app-dashboard-empty',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule],
  templateUrl: './dashboard-empty.component.html',
  styleUrl: './dashboard-empty.component.scss',
  host: { '[attr.data-variant]': 'variant' }
})
export class DashboardEmptyComponent {
  /** Custom image URL — takes priority over everything else */
  @Input() imageSrc: string | null = null;
  /** Tabler icon name — falls back to a per-variant default when not set */
  @Input() icon: string | null = null;
  @Input() variant: DashboardEmptyVariant = 'empty';
  @Input() titleKey = 'd3.emptyState.defaultTitle';
  @Input() descKey = 'd3.emptyState.defaultDesc';
  /** Translation key for an optional action button (e.g. "Add", "Retry", "Clear filters") */
  @Input() actionKey: string | null = null;
  @Input() actionIcon: string | null = null;
  @Output() action = new EventEmitter<void>();

  get resolvedIcon(): string {
    return this.icon || DEFAULT_ICONS[this.variant];
  }
}
