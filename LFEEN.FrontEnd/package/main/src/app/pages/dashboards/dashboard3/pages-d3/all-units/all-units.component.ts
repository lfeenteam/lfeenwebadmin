import { CommonModule } from '@angular/common';
import { Component, inject, effect, ChangeDetectorRef } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';
import { DashboardSubHeaderComponent } from 'src/app/components/dashboard3/dashboard-sub-header/dashboard-sub-header.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { MetricCard, TabOption, ViewMode, BuildFilterOption } from '../../interfaces/dashboard-sub-header.model';
import { UnitsService, UnitSortOrder } from '../../services/units.service';
import { BuildingWithUnits, UnitTab } from '../../interfaces/unit-card.model';
import { CardsUnitsComponent } from './cards-units/cards-units.component';
import { AutoApprovalSettingsDialogComponent } from './auto-approval-settings-dialog/auto-approval-settings-dialog.component';
import { LoginService } from '../../services/login/login.service';
import { formatNumber, getVisiblePages } from 'src/app/utils/pagination.util';

@Component({
  selector: 'app-all-units',
  standalone: true,
  imports: [
    CommonModule,
    TablerIconsModule,
    TranslateModule,
    MaterialModule,
    DashboardSubHeaderComponent,
    DashboardLoadingComponent,
    CardsUnitsComponent
  ],
  templateUrl: './all-units.component.html',
  styleUrl: './all-units.component.scss'
})
export class AllUnitsComponent {
  private unitsService = inject(UnitsService);
  private cdr          = inject(ChangeDetectorRef);
  private translate    = inject(TranslateService);
  private dialog       = inject(MatDialog);
  private login        = inject(LoginService);

  activeTab: string = this.unitsService.activeTab();
  searchQuery       = '';
  viewMode: ViewMode = 'list';
  buildingsWithUnits: BuildingWithUnits[] = [];
  isLoading    = false;
  totalCount   = 0;
  totalPages   = 1;
  currentPage  = 1;

  metrics: MetricCard[] = [
    { titleKey: 'd3.allUnits.cards.totalUnits',        value: '—', icon: 'building',     tone: 'black'  },
    { titleKey: 'd3.allUnits.cards.activeUnits',      value: '—', icon: 'circle-check', tone: 'green'  },
    { titleKey: 'd3.allUnits.cards.unpublishedUnits',  value: '—', icon: 'player-pause', tone: 'gray'   },
    { titleKey: 'd3.allUnits.cards.underReviewUnits', value: '—', icon: 'clock-hour-3', tone: 'orange' }
  ];

  tabs: TabOption[] = [
    { id: 'draft',       labelKey: 'd3.allUnits.tabs.draft'       },
    { id: 'published',   labelKey: 'd3.allUnits.tabs.published'   },
    { id: 'new',         labelKey: 'd3.allUnits.tabs.new'         },
    { id: 'underReview', labelKey: 'd3.allUnits.tabs.underReview' },
    { id: 'pendingChanges', labelKey: 'd3.allUnits.tabs.pendingChanges' },
    { id: 'rejected',    labelKey: 'd3.allUnits.tabs.rejected'    },
    { id: 'banned',      labelKey: 'd3.allUnits.tabs.banned'      }
  ];

  filterOptions: BuildFilterOption[] = [
    {
      id: 'account',
      labelKey: 'd3.allUnits.filters.allAccounts',
      items: [{ value: 'all', labelKey: 'd3.allUnits.filters.allAccounts' }]
    },
    {
      id: 'property',
      labelKey: 'd3.allUnits.filters.allProperties',
      items: [{ value: 'all', labelKey: 'd3.allUnits.filters.allProperties' }]
    },
    {
      id: 'sort',
      labelKey: 'd3.allUnits.filters.sortNewest',
      items: [
        { value: 'newest',           labelKey: 'd3.allUnits.filters.sortNewest'           },
        { value: 'oldest',           labelKey: 'd3.allUnits.filters.sortOldest'           },
        { value: 'highestOccupancy', labelKey: 'd3.allUnits.filters.sortHighestOccupancy' },
      ]
    }
  ];

  searchPlaceholder = 'd3.allUnits.filters.searchPlaceholder';

  constructor() {
    // sync main data
    effect(() => {
      this.buildingsWithUnits = this.unitsService.paginatedBuildings();
      this.isLoading   = this.unitsService.isLoading();
      this.totalCount  = this.unitsService.totalCount();
      this.totalPages  = this.unitsService.totalBuildingPages();
      this.currentPage = this.unitsService.buildingsPage();

      const s = this.unitsService.unitStats();
      if (s) {
        this.metrics = [
          { ...this.metrics[0], value: formatNumber(s.total)             },
          { ...this.metrics[1], value: formatNumber(s.activeOrPublished) },
          { ...this.metrics[2], value: formatNumber(s.pendingOrRejected) },
          { ...this.metrics[3], value: formatNumber(s.underReview)       },
        ];
        // stats aren't affected by the active filter, so this count holds on every tab.
        this.tabs = this.tabs.map(t => t.id === 'banned' ? { ...t, count: s.banned ?? null } : t);
      }

      this.cdr.markForCheck();
    });

    // sync filter dropdowns from loaded units (reactive — updates on data changes)
    effect(() => {
      const accounts   = this.unitsService.accountsForFilter();
      const properties = this.unitsService.propertiesForFilter();
      this.filterOptions = this.filterOptions.map(f => {
        if (f.id === 'account') {
          return {
            ...f,
            items: [
              { value: 'all', labelKey: 'd3.allUnits.filters.allAccounts' },
              ...accounts,
            ]
          };
        }
        if (f.id === 'property') {
          return {
            ...f,
            items: [
              { value: 'all', labelKey: 'd3.allUnits.filters.allProperties' },
              ...properties,
            ]
          };
        }
        return f;
      });
      this.cdr.markForCheck();
    });
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  /** Units.ManageSettings — only SuperAdmin has it by default. */
  get canManageSettings(): boolean {
    return this.login.permissions().some(p => p.toLowerCase() === 'units.managesettings');
  }

  openAutoApprovalSettings(): void {
    if (!this.canManageSettings) return;
    this.dialog.open(AutoApprovalSettingsDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
      autoFocus: 'dialog',
    });
  }

  get isReviewTab(): boolean {
    return this.activeTab === 'new' || this.activeTab === 'underReview' || this.activeTab === 'pendingChanges';
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
    this.unitsService.setTab(tab as UnitTab);
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    this.unitsService.setSearch(query);
  }

  onFiltersChange(filters: Record<string, string>): void {
    const accountId  = filters['account']  === 'all' ? '' : (filters['account']  ?? '');
    const propertyId = filters['property'] === 'all' ? '' : (filters['property'] ?? '');
    const sort       = (filters['sort'] ?? 'newest') as UnitSortOrder;
    this.unitsService.setAccountFilter(accountId);
    this.unitsService.setPropertyFilter(propertyId);
    this.unitsService.setSortOrder(sort);
  }

  setViewMode(mode: ViewMode): void {
    this.viewMode = mode;
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.unitsService.goToBuildingPage(page);
  }
}
