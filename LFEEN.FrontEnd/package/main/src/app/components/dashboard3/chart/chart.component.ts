import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  NgApexchartsModule,
  ChartComponent as ApexChartComponent,
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexStroke,
  ApexFill,
  ApexGrid,
  ApexDataLabels,
  ApexTooltip,
  ApexMarkers,
} from 'ng-apexcharts';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  fill: ApexFill;
  grid: ApexGrid;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  markers: ApexMarkers;
  colors: string[];
};

interface ComparisonRow {
  label: string;
  hosts: string;
  guests: string;
  hostsColor?: string;
  guestsColor?: string;
}

@Component({
  selector: 'app-dashboard3-chart',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, TranslateModule],
  templateUrl: './chart.component.html',
  styleUrl: './chart.component.scss'
})
export class ChartComponent {
  @ViewChild('chart') chart!: ApexChartComponent;

  tabs: string[] = ['d3.chart.tabNewGuests', 'd3.chart.tabNewHosts', 'd3.chart.tabBookings'];
  activeTab = 0;

  tabData: number[][] = [
    [28, 34, 27, 25, 26, 32, 45, 63, 78, 82, 76, 60, 43, 36, 52, 86, 130, 170, 190, 178, 145],
    [20, 26, 22, 24, 30, 38, 50, 62, 70, 68, 58, 44, 40, 48, 68, 92, 125, 150, 162, 148, 120],
    [35, 40, 34, 30, 32, 42, 58, 74, 90, 94, 86, 66, 50, 44, 62, 98, 138, 176, 198, 184, 150]
  ];

  chartOptions: ChartOptions = {
    series: [
      {
        name: '',
        data: this.tabData[0]
      }
    ],
    chart: {
      type: 'area',
      height: 230,
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: 'Cairo, sans-serif',
      sparkline: { enabled: true }
    },
    colors: ['#0F172B'],
    stroke: {
      curve: 'smooth',
      width: 2.5,
      lineCap: 'round'
    },
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'light',
        type: 'vertical',
        opacityFrom: 0.1,
        opacityTo: 0,
        stops: [0, 100],
        colorStops: [
          { offset: 0, color: '#000000', opacity: 0.1 },
          { offset: 100, color: '#000000', opacity: 0 }
        ]
      }
    },
    grid: {
      show: false,
      padding: { left: -10, right: 10, top: 8, bottom: -10 }
    },
    dataLabels: { enabled: false },
    markers: {
      size: 0,
      colors: ['#FFFFFF'],
      strokeColors: '#0F172B',
      strokeWidth: 2,
      hover: { size: 6 },
      discrete: [
        { seriesIndex: 0, dataPointIndex: 4, fillColor: '#FFFFFF', strokeColor: '#0F172B', size: 5 },
        { seriesIndex: 0, dataPointIndex: 8, fillColor: '#FFFFFF', strokeColor: '#0F172B', size: 5 },
        { seriesIndex: 0, dataPointIndex: 16, fillColor: '#FFFFFF', strokeColor: '#0F172B', size: 5 },
        { seriesIndex: 0, dataPointIndex: 20, fillColor: '#FFFFFF', strokeColor: '#0F172B', size: 5 }
      ]
    },
    tooltip: { enabled: false },
    xaxis: {
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false },
      crosshairs: { show: false },
      tooltip: { enabled: false }
    },
    yaxis: {
      min: 0,
      max: 210,
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false }
    }
  };

  comparisonRows: ComparisonRow[] = [
    { label: 'd3.chart.rowTotal', hosts: '12.4k', guests: '45.8k' },
    { label: 'd3.chart.rowImmunizations', hosts: '32k', guests: '120k' },
    { label: 'd3.chart.rowRating', hosts: '4.9', guests: '4.8' },
    { label: 'd3.chart.rowCancelRate', hosts: '3.2%', guests: '8.4%', hostsColor: '#F59E0B', guestsColor: '#EF4444' },
    { label: 'd3.chart.rowOpenComplaints', hosts: '12', guests: '24', hostsColor: '#F59E0B', guestsColor: '#F59E0B' }
  ];

  distributionSegments = [
    { label: 'd3.chart.segHotels', value: 45, color: '#0F172B' },
    { label: 'd3.chart.segIndividuals', value: 35, color: '#3B82F6' },
    { label: 'd3.chart.segCompanies', value: 20, color: '#CAD5E2' }
  ];

  constructor(private translate: TranslateService) {
    this.chartOptions.series = [{ name: this.translate.instant('d3.chart.growthSeries'), data: this.tabData[0] }];
  }

  setTab(idx: number) {
    this.activeTab = idx;
    this.chartOptions.series = [
      { name: this.translate.instant('d3.chart.growthSeries'), data: this.tabData[idx] }
    ];
  }
}
