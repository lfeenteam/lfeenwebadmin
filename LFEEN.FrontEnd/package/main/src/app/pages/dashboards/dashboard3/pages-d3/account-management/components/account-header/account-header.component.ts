import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { AccountTab } from '../account-tabs-bar/account-tabs-bar.component';

@Component({
  selector: 'app-account-header',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './account-header.component.html',
  styleUrl: './account-header.component.scss'
})
export class AccountHeaderComponent {
  @Input() searchQuery = '';
  @Input() activeTab: AccountTab = 'all';
  @Input() newestFirst = true;

  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() tabChange        = new EventEmitter<AccountTab>();
  @Output() sortChange       = new EventEmitter<boolean>();

  readonly statusOptions: { value: AccountTab | ''; label: string }[] = [
    { value: '',             label: 'd3.accountManagement.filters.all'        },
    { value: 'active',       label: 'd3.accountManagement.tabs.active'        },
    { value: 'rejected',     label: 'd3.accountManagement.tabs.rejected'      },
    { value: 'under_review', label: 'd3.accountManagement.tabs.underReview'   },
  ];

  readonly sortOptions: { value: boolean; label: string }[] = [
    { value: true,  label: 'd3.accountManagement.filters.newest' },
    { value: false, label: 'd3.accountManagement.filters.oldest' },
  ];

  get selectedStatus(): AccountTab | '' {
    return this.activeTab === 'all' ? '' : this.activeTab;
  }

  onStatusChange(value: AccountTab | ''): void {
    this.tabChange.emit(value === '' ? 'all' : value);
  }

  onSortChange(value: boolean): void {
    this.sortChange.emit(value);
  }
}
