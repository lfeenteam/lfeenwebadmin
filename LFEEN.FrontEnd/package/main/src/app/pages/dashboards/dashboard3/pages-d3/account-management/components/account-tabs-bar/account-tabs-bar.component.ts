import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule } from '@ngx-translate/core';

export type AccountTab = 'all' | 'active' | 'rejected' | 'under_review';

@Component({
  selector: 'app-account-tabs-bar',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslateModule],
  templateUrl: './account-tabs-bar.component.html',
  styleUrl: './account-tabs-bar.component.scss'
})
export class AccountTabsBarComponent {
  @Input() activeTab: AccountTab = 'all';
  @Output() tabChange = new EventEmitter<AccountTab>();

  readonly tabs: { key: AccountTab; label: string; hasDot?: boolean }[] = [
    { key: 'all',          label: 'd3.accountManagement.tabs.all' },
    { key: 'active',       label: 'd3.accountManagement.tabs.active' },
    { key: 'rejected',     label: 'd3.accountManagement.tabs.rejected' },
    { key: 'under_review', label: 'd3.accountManagement.tabs.underReview', hasDot: true },
  ];
}
