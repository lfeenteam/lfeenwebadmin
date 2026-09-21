import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { TabsFilterComponent } from 'src/app/pages/dashboards/dashboard3/pages-d3/all-builds/tabs-filter/tabs-filter.component';
import { MetricCard, TabOption, ViewMode, BuildFilterOption } from '../../../pages/dashboards/dashboard3/interfaces/dashboard-sub-header.model';

@Component({
  selector: 'app-dashboard-sub-header',
  standalone: true,
  imports: [
    CommonModule,
    TablerIconsModule,
    TranslateModule,
    TabsFilterComponent
  ],
  templateUrl: './dashboard-sub-header.component.html',
  styleUrl: './dashboard-sub-header.component.scss'
})
export class DashboardSubHeaderComponent {
  @Input() metrics: MetricCard[] = [];
  @Input() tabs: TabOption[] = [];
  @Input() activeTab: string = '';
  @Input() searchQuery: string = '';
  @Input() viewMode: ViewMode = 'grid';
  @Input() filterOptions: BuildFilterOption[] = [];
  @Input() searchPlaceholder: string = 'd3.allBuilds.filters.searchPlaceholder';

  @Output() activeTabChange = new EventEmitter<string>();
  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() viewModeChange = new EventEmitter<ViewMode>();
  @Output() filtersChange = new EventEmitter<Record<string, string>>();

  selectTab(tabId: string): void {
    this.activeTabChange.emit(tabId);
  }

  onSearch(query: string): void {
    this.searchQueryChange.emit(query);
  }

  setViewMode(mode: ViewMode): void {
    this.viewModeChange.emit(mode);
  }

  onFiltersChange(filters: Record<string, string>): void {
    this.filtersChange.emit(filters);
  }
}
