import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
import { BuildingTab } from '../building-card.model';

export interface BuildFilterOption {
  id: string;
  labelKey: string;
  items: { value: string; labelKey: string }[];
}

@Component({
  selector: 'app-tabs-filter',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule, MaterialModule],
  templateUrl: './tabs-filter.component.html',
  styleUrl: './tabs-filter.component.scss'
})
export class TabsFilterComponent {
  @Input() activeTab: string = 'published';
  @Input() searchQuery = '';
  @Input() tabs: { id: string; labelKey: string }[] = [
    { id: 'published', labelKey: 'd3.allBuilds.tabs.published' },
    { id: 'underReview', labelKey: 'd3.allBuilds.tabs.underReview' }
  ];
  @Input() filterOptions: BuildFilterOption[] = [
    {
      id: 'status',
      labelKey: 'd3.allBuilds.filters.allStatuses',
      items: [
        { value: 'all', labelKey: 'd3.allBuilds.filters.options.all' },
        { value: 'active', labelKey: 'd3.allBuilds.buildingCard.statusActive' },
        { value: 'stopped', labelKey: 'd3.allBuilds.buildingCard.statusStopped' }
      ]
    },
    {
      id: 'city',
      labelKey: 'd3.allBuilds.filters.allCities',
      items: [
        { value: 'all', labelKey: 'd3.allBuilds.filters.options.all' },
        { value: 'riyadh', labelKey: 'd3.allBuilds.filters.options.riyadh' },
        { value: 'jeddah', labelKey: 'd3.allBuilds.filters.options.jeddah' },
        { value: 'dammam', labelKey: 'd3.allBuilds.filters.options.dammam' }
      ]
    },
    {
      id: 'type',
      labelKey: 'd3.allBuilds.filters.allTypes',
      items: [
        { value: 'all', labelKey: 'd3.allBuilds.filters.options.all' },
        { value: 'hotel', labelKey: 'd3.allBuilds.filters.options.hotel' },
        { value: 'apartments', labelKey: 'd3.allBuilds.filters.options.apartments' },
        { value: 'villas', labelKey: 'd3.allBuilds.filters.options.villas' }
      ]
    },
    {
      id: 'sort',
      labelKey: 'd3.allBuilds.filters.newest',
      items: [
        { value: 'newest', labelKey: 'd3.allBuilds.filters.newest' },
        { value: 'oldest', labelKey: 'd3.allBuilds.filters.options.oldest' },
        { value: 'occupancy', labelKey: 'd3.allBuilds.filters.options.occupancyHigh' }
      ]
    }
  ];
  @Input() searchPlaceholder: string = 'd3.allBuilds.filters.searchPlaceholder';

  @Output() activeTabChange = new EventEmitter<string>();
  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() filtersChange = new EventEmitter<Record<string, string>>();

  selectedFilters: Record<string, string> = {
    status: 'all',
    city: 'all',
    type: 'all',
    sort: 'newest'
  };

  selectTab(tab: string): void {
    if (this.activeTab === tab) {
      return;
    }
    this.activeTab = tab;
    this.activeTabChange.emit(tab);
  }

  onSearchInput(value: string): void {
    this.searchQuery = value;
    this.searchQueryChange.emit(value);
  }

  getFilterLabelKey(filter: BuildFilterOption): string {
    const selected = this.selectedFilters[filter.id];
    const item = filter.items.find((entry) => entry.value === selected);

    if (!item || item.value === 'all') {
      return filter.labelKey;
    }

    return item.labelKey;
  }

  selectFilterOption(filterId: string, value: string): void {
    this.selectedFilters = { ...this.selectedFilters, [filterId]: value };
    this.filtersChange.emit(this.selectedFilters);
  }

  isFilterSelected(filterId: string, value: string): boolean {
    return this.selectedFilters[filterId] === value;
  }
}
