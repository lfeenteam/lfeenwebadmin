import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule } from '@ngx-translate/core';
import { PAGE_FLAGS } from 'src/app/config/page-flags';

export type AccountTab = 'all' | 'active' | 'rejected' | 'under_review';
// profile_changes isn't an account status: it lists settings change requests from
// their own endpoint, so it stays out of AccountTab (AccountService's filter).
export type AccountsPageTab = AccountTab | 'profile_changes';

@Component({
  selector: 'app-account-tabs-bar',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslateModule],
  templateUrl: './account-tabs-bar.component.html',
  styleUrl: './account-tabs-bar.component.scss'
})
export class AccountTabsBarComponent {
  @Input() activeTab: AccountsPageTab = 'all';
  // Pending profile changes; shown on that tab when known and non-zero.
  @Input() profileChangesCount: number | null = null;
  @Output() tabChange = new EventEmitter<AccountsPageTab>();

  readonly tabs: { key: AccountsPageTab; label: string; hasDot?: boolean }[] = [
    { key: 'all',          label: 'd3.accountManagement.tabs.all' },
    { key: 'active',       label: 'd3.accountManagement.tabs.active' },
    { key: 'rejected',     label: 'd3.accountManagement.tabs.rejected' },
    { key: 'under_review', label: 'd3.accountManagement.tabs.underReview', hasDot: true },
    ...(PAGE_FLAGS['profile-changes']
      ? [{ key: 'profile_changes' as const, label: 'd3.accountManagement.tabs.profileChanges' }]
      : []),
  ];
}
