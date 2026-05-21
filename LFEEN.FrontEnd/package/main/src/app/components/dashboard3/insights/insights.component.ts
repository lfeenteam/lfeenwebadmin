import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';

interface DecisionItem {
  title: string;
  description: string;
  icon: string;
  type: 'urgent' | 'warning' | 'info' | 'success' | 'neutral';
}

interface RevenueSource {
  label: string;
  percent: number;
  color: string;
}

interface CityItem {
  rank: number;
  name: string;
  reservations: string;
  hosts: string;
  status: 'excellent' | 'growth' | 'stable' | 'new';
}

@Component({
  selector: 'app-dashboard3-insights',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './insights.component.html',
  styleUrl: './insights.component.scss'
})
export class InsightsComponent {
  decisions: DecisionItem[] = [
    {
      title: 'd3.insights.decision1Title',
      description: 'd3.insights.decision1Desc',
      icon: 'clock-hour-4',
      type: 'urgent'
    },
    {
      title: 'd3.insights.decision2Title',
      description: 'd3.insights.decision2Desc',
      icon: 'user-check',
      type: 'warning'
    },
    {
      title: 'd3.insights.decision3Title',
      description: 'd3.insights.decision3Desc',
      icon: 'rocket',
      type: 'info'
    },
    {
      title: 'd3.insights.decision4Title',
      description: 'd3.insights.decision4Desc',
      icon: 'crown',
      type: 'success'
    },
    {
      title: 'd3.insights.decision5Title',
      description: 'd3.insights.decision5Desc',
      icon: 'settings',
      type: 'neutral'
    }
  ];

  revenueSources: RevenueSource[] = [
    { label: 'd3.insights.revenueBookingCommission', percent: 65, color: '#0F172B' },
    { label: 'd3.insights.revenueMonthlySubscriptions', percent: 20, color: '#2B7FFF' },
    { label: 'd3.insights.revenueFeaturedAds', percent: 10, color: '#00BC7D' },
    { label: 'd3.insights.revenueAdditionalServices', percent: 5, color: '#CBD5E1' }
  ];

  cities: CityItem[] = [
    { rank: 1, name: 'd3.insights.cityRiyadh', reservations: '1,420', hosts: '420', status: 'excellent' },
    { rank: 2, name: 'd3.insights.cityJeddah', reservations: '1,150', hosts: '380', status: 'growth' },
    { rank: 3, name: 'd3.insights.cityDammam', reservations: '840', hosts: '210', status: 'growth' },
    { rank: 4, name: 'd3.insights.cityMakkah', reservations: '620', hosts: '180', status: 'stable' },
    { rank: 5, name: 'd3.insights.cityMadinah', reservations: '410', hosts: '150', status: 'stable' },
    { rank: 6, name: 'd3.insights.cityKhobar', reservations: '220', hosts: '65', status: 'new' }
  ];

  statusLabel(status: string): string {
    switch (status) {
      case 'excellent': return 'd3.insights.statusExcellent';
      case 'growth': return 'd3.insights.statusGrowth';
      case 'stable': return 'd3.insights.statusStable';
      case 'new': return 'd3.insights.statusNew';
      default: return '';
    }
  }
}
