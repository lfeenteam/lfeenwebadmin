import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';

export type AccountTab = 'all' | 'active' | 'rejected' | 'under_review';

@Component({
  selector: 'app-account-tabs-bar',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './account-tabs-bar.component.html',
  styleUrl: './account-tabs-bar.component.scss'
})
export class AccountTabsBarComponent {
  @Input() activeTab: AccountTab = 'all';
  @Output() tabChange = new EventEmitter<AccountTab>();

  readonly tabs: { key: AccountTab; label: string; hasDot?: boolean }[] = [
    { key: 'all',          label: 'الكل' },
    { key: 'active',       label: 'الحسابات النشطة' },
    { key: 'rejected',     label: 'الحسابات المرفوضة' },
    { key: 'under_review', label: 'حسابات تحت المراجعة', hasDot: true },
  ];
}
