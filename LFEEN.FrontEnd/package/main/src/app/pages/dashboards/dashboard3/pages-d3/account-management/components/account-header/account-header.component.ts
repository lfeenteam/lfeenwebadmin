import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-account-header',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './account-header.component.html',
  styleUrl: './account-header.component.scss'
})
export class AccountHeaderComponent {
  @Input() searchQuery = '';
  @Input() activeFilter = 'all';
  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() filterChange = new EventEmitter<string>();

  readonly filters = [
    { key: 'all',    label: 'كل الحسابات' },
    { key: 'status', label: 'كل الحالات' },
    { key: 'newest', label: 'ترتيب الأحدث' },
  ];
}
