import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';
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
export class TabsFilterComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() activeTab: string = '';
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
        { value: 'all',            labelKey: 'd3.allBuilds.filters.options.all'  },
        { value: 'draft',          labelKey: 'd3.allBuilds.tabs.draft'           },
        { value: 'published',      labelKey: 'd3.allBuilds.tabs.published'       },
        { value: 'new',            labelKey: 'd3.allBuilds.tabs.new'             },
        { value: 'underReview',    labelKey: 'd3.allBuilds.tabs.underReview'     },
        { value: 'pendingChanges', labelKey: 'd3.allBuilds.tabs.pendingChanges'  },
        { value: 'rejected',       labelKey: 'd3.allBuilds.tabs.rejected'        }
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
  /** The small "more filters" icon button that opens the mobile bottom sheet — on by
   * default (existing pages rely on it for narrow screens). Pages that already show
   * every filter as its own dropdown pill with no narrow-screen fallback can turn it off. */
  @Input() showMoreFiltersButton = true;

  /** Lets a parent that owns the filter state externally (e.g. resets it via its own
   * "clear filters" button) keep these dropdown pills in sync — optional, other pages
   * that only read `filtersChange` don't need to pass it. */
  @Input() set activeFilters(value: Record<string, string> | undefined) {
    if (value) {
      this.selectedFilters = { ...this.selectedFilters, ...value };
    }
  }

  @Output() activeTabChange = new EventEmitter<string>();
  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() filtersChange = new EventEmitter<Record<string, string>>();

  selectedFilters: Record<string, string> = {
    status: 'all',
    city: 'all',
    type: 'all',
    sort: 'newest'
  };

  filterSearchTerms: Record<string, string> = {};

  mobileFilterOpen = false;

  /** Overflow affordance for the horizontally scrolling tab strip (mobile view):
   * whether there are more tabs hidden past the start / end edge. */
  canScrollStart = false;
  canScrollEnd = false;

  @ViewChild('tabsRow') private tabsRow?: ElementRef<HTMLElement>;
  private tabsResizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    const el = this.tabsRow?.nativeElement;
    if (el && typeof ResizeObserver !== 'undefined') {
      this.tabsResizeObserver = new ResizeObserver(() => this.updateTabsScrollState());
      this.tabsResizeObserver.observe(el);
    }
    this.updateTabsScrollState();
  }

  ngOnChanges(): void {
    // Tab list can change (different page passes its own tabs) — re-measure next frame.
    Promise.resolve().then(() => this.updateTabsScrollState());
  }

  ngOnDestroy(): void {
    this.tabsResizeObserver?.disconnect();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateTabsScrollState();
  }

  updateTabsScrollState(): void {
    const el = this.tabsRow?.nativeElement;
    if (!el) {
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 1) {
      this.canScrollStart = false;
      this.canScrollEnd = false;
      return;
    }
    // Normalise scroll position across LTR/RTL (RTL reports a negative scrollLeft
    // in modern browsers) so the math is direction-agnostic.
    const scrolled = Math.abs(el.scrollLeft);
    this.canScrollStart = scrolled > 1;
    this.canScrollEnd = scrolled < maxScroll - 1;
  }

  scrollTabs(direction: 1 | -1): void {
    const el = this.tabsRow?.nativeElement;
    if (!el) {
      return;
    }
    const isRtl = getComputedStyle(el).direction === 'rtl';
    const amount = el.clientWidth * 0.75 * direction * (isRtl ? -1 : 1);
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }

  getFilteredItems(filter: BuildFilterOption): { value: string; labelKey: string }[] {
    const term = (this.filterSearchTerms[filter.id] ?? '').toLowerCase().trim();
    if (!term) return filter.items;
    return filter.items.filter(item =>
      item.value === 'all' || item.labelKey.toLowerCase().includes(term)
    );
  }

  stopPropagation(e: Event): void {
    e.stopPropagation();
  }

  toggleMobileFilter(): void {
    this.mobileFilterOpen = !this.mobileFilterOpen;
  }

  closeMobileFilter(): void {
    this.mobileFilterOpen = false;
  }

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
