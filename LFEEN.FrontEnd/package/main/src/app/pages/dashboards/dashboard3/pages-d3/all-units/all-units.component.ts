import { CommonModule } from '@angular/common';
import { Component, inject, effect, ChangeDetectorRef } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardSubHeaderComponent } from 'src/app/components/dashboard3/dashboard-sub-header/dashboard-sub-header.component';
import { MetricCard, TabOption, ViewMode, BuildFilterOption } from '../../interfaces/dashboard-sub-header.model';
import { UnitsService } from '../../services/units.service';
import { BuildingWithUnits, UnitTab } from '../../interfaces/unit-card.model';
import { CardsUnitsComponent } from './cards-units/cards-units.component';

@Component({
  selector: 'app-all-units',
  standalone: true,
  imports: [
    CommonModule,
    TablerIconsModule,
    TranslateModule,
    DashboardSubHeaderComponent,
    CardsUnitsComponent
  ],
  templateUrl: './all-units.component.html',
  styleUrl: './all-units.component.scss'
})
export class AllUnitsComponent {
  private unitsService = inject(UnitsService);
  private cdr          = inject(ChangeDetectorRef);
  private translate    = inject(TranslateService);

  activeTab: string = 'new';
  searchQuery       = '';
  viewMode: ViewMode = 'grid';
  buildingsWithUnits: BuildingWithUnits[] = [];
  isLoading    = false;
  totalPages   = 1;
  currentPage  = 1;
  totalCount   = 0;

  metrics: MetricCard[] = [
    { titleKey: 'd3.allUnits.cards.publishedUnits',   value: '—', icon: 'building',     tone: 'black'  },
    { titleKey: 'd3.allUnits.cards.activeUnits',      value: '—', icon: 'circle-check', tone: 'green'  },
    { titleKey: 'd3.allUnits.cards.stoppedUnits',     value: '—', icon: 'player-pause', tone: 'gray'   },
    { titleKey: 'd3.allUnits.cards.underReviewUnits', value: '—', icon: 'clock-hour-3', tone: 'orange' }
  ];

  tabs: TabOption[] = [
    { id: 'published',   labelKey: 'd3.allUnits.tabs.published'   },
    { id: 'new',         labelKey: 'd3.allUnits.tabs.new'         },
    { id: 'underReview', labelKey: 'd3.allUnits.tabs.underReview' },
    { id: 'rejected',    labelKey: 'd3.allUnits.tabs.rejected'    }
  ];

  filterOptions: BuildFilterOption[] = [
    {
      id: 'sort',
      labelKey: 'd3.allUnits.filters.sortNewest',
      items: [
        { value: 'newest', labelKey: 'd3.allUnits.filters.sortNewest' }
      ]
    }
  ];

  searchPlaceholder = 'd3.allUnits.filters.searchPlaceholder';

  constructor() {
    effect(() => {
      this.buildingsWithUnits = this.unitsService.buildingsWithUnitsSignal();
      this.isLoading    = this.unitsService.isLoading();
      this.totalPages   = this.unitsService.totalPages();
      this.currentPage  = this.unitsService.currentPage();
      this.totalCount   = this.unitsService.totalCount();
      this.cdr.markForCheck();
    });
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): (number | '...')[] {
    const n = this.totalPages;
    const c = this.currentPage;

    if (n <= 7) return Array.from({ length: n }, (_, i) => i + 1);
    if (c <= 4)     return [1, 2, 3, 4, '...', n - 2, n - 1, n];
    if (c >= n - 3) return [1, 2, 3, '...', n - 3, n - 2, n - 1, n];
    return [1, 2, 3, '...', c, '...', n - 2, n - 1, n];
  }

  get isReviewTab(): boolean {
    return this.activeTab === 'new' || this.activeTab === 'underReview';
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
    this.unitsService.setTab(tab as UnitTab);
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    this.unitsService.setSearch(query);
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.unitsService.goToPage(page);
  }
}
