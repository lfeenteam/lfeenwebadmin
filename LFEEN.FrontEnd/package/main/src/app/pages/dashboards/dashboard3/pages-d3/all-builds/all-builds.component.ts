import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import {
  BuildingCardItem,
  BuildingTab,
  BuildingViewMode
} from './building-card.model';
import { CardsBuildsComponent } from './cards-builds/cards-builds.component';
import { TabsFilterComponent } from './tabs-filter/tabs-filter.component';

interface BuildingMetricCard {
  titleKey: string;
  value: string;
  icon: string;
  tone: 'green' | 'gray' | 'black' | 'orange';
}

@Component({
  selector: 'app-all-builds',
  standalone: true,
  imports: [
    CommonModule,
    TablerIconsModule,
    TranslateModule,
    TabsFilterComponent,
    CardsBuildsComponent
  ],
  templateUrl: './all-builds.component.html',
  styleUrl: './all-builds.component.scss'
})
export class AllBuildsComponent {
  activeTab: BuildingTab = 'published';
  searchQuery = '';
  viewMode: BuildingViewMode = 'grid';

  cards: BuildingMetricCard[] = [
    {
      titleKey: 'd3.allBuilds.cards.buildingsAvailable',
      value: '1,10',
      icon: 'circle-check',
      tone: 'green'
    },
    {
      titleKey: 'd3.allBuilds.cards.activeBuildings',
      value: '192',
      icon: 'player-pause',
      tone: 'gray'
    },
    {
      titleKey: 'd3.allBuilds.cards.totalUnits',
      value: '25,910',
      icon: 'building',
      tone: 'black'
    },
    {
      titleKey: 'd3.allBuilds.cards.monthlyUnits',
      value: '14',
      icon: 'clock-hour-3',
      tone: 'orange'
    }
  ];

  private readonly allBuildings: BuildingCardItem[] = [
    {
      id: '1',
      title: 'فندق واحة الرياض',
      host: 'مجموعة ريادة الفندقية',
      location: 'الرياض، حي العليا',
      status: 'active',
      typeLabel: 'فندق',
      units: 120,
      occupancy: 85,
      bookings: 42,
      lastUpdate: '١٤ أكتوبر',
      tab: 'published'
    },
    {
      id: '2',
      title: 'شقق نرجس الفاخرة',
      host: 'شركة إيواء العقارية',
      location: 'جدة، حي الشاطئ',
      status: 'active',
      typeLabel: 'شقق سكنية',
      units: 45,
      occupancy: 63,
      bookings: 18,
      lastUpdate: '١٢ أكتوبر',
      tab: 'published'
    },
    {
      id: '3',
      title: 'مجمع نسيم الدمام',
      host: 'فهد القحطاني (فرد)',
      location: 'الدمام، حي الزهور',
      status: 'stopped',
      typeLabel: 'وحدات مؤسسية',
      units: 18,
      occupancy: 0,
      bookings: 0,
      lastUpdate: '٠٨ أكتوبر',
      tab: 'published'
    },
    {
      id: '4',
      title: 'شاليهات البحر الأحمر',
      host: 'شركة البحر للمنتجعات',
      location: 'ينبع، الواجهة البحرية',
      status: 'active',
      typeLabel: 'شاليهات',
      units: 12,
      occupancy: 92,
      bookings: 8,
      lastUpdate: '٠٥ أكتوبر',
      tab: 'published'
    },
    {
      id: '5',
      title: 'فلل المروج الفاخرة',
      host: 'المطور العقاري الحديث',
      location: 'الخبر، حي المروج',
      status: 'active',
      typeLabel: 'فلل',
      units: 8,
      occupancy: 62,
      bookings: 3,
      lastUpdate: '٠١ أكتوبر',
      tab: 'published'
    },
    {
      id: '6',
      title: 'استراحات الوادي',
      host: 'صاحب المنشأة',
      location: 'الطائف، شفا',
      status: 'active',
      typeLabel: 'استراحات',
      units: 15,
      occupancy: 45,
      bookings: 12,
      lastUpdate: '٢٥ سبتمبر',
      tab: 'published'
    },
    {
      id: '7',
      title: 'برج السماء التجاري',
      host: 'شركة سكاى العقارية',
      location: 'الرياض، العليا',
      status: 'active',
      typeLabel: 'وحدات مؤسسية',
      units: 80,
      occupancy: 68,
      bookings: 22,
      lastUpdate: '٢٠ سبتمبر',
      tab: 'underReview'
    },
    {
      id: '8',
      title: 'منتجع الشاطئ الذهبي',
      host: 'مجموعة الضيافة',
      location: 'جدة، الكورنيش',
      status: 'active',
      typeLabel: 'فندق',
      units: 95,
      occupancy: 55,
      bookings: 31,
      lastUpdate: '١٥ سبتمبر',
      tab: 'underReview'
    }
  ];

  get filteredBuildings(): BuildingCardItem[] {
    const query = this.searchQuery.trim().toLowerCase();

    return this.allBuildings.filter((building) => {
      if (building.tab !== this.activeTab) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        building.title.toLowerCase().includes(query) ||
        building.location.toLowerCase().includes(query)
      );
    });
  }

  setViewMode(mode: BuildingViewMode): void {
    this.viewMode = mode;
  }
}
