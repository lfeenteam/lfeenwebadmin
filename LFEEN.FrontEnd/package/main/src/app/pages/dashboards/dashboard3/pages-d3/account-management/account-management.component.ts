import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { StatsRowComponent } from '../team-management/components/stats-row/stats-row.component';
import { AccountHeaderComponent } from './components/account-header/account-header.component';
import { AccountTabsBarComponent, AccountTab } from './components/account-tabs-bar/account-tabs-bar.component';
import { AccountCardComponent } from './components/account-card/account-card.component';

export interface Account {
  id: string;
  name: string;
  type: 'individual' | 'company';
  status: 'active' | 'suspended' | 'under_review' | 'rejected';
  idNumber: string;
  joinDate: string;
  propertyCount: number;
  unit: string;
  avatarInitials?: string;
  paymentBadge?: string;
  tradeName?: string;
}

@Component({
  selector: 'app-account-management',
  standalone: true,
  imports: [
    CommonModule,
    MaterialModule,
    TablerIconsModule,
    StatsRowComponent,
    AccountHeaderComponent,
    AccountTabsBarComponent,
    AccountCardComponent,
  ],
  templateUrl: './account-management.component.html',
  styleUrl: './account-management.component.scss'
})
export class AccountManagementComponent {
  activeTab: AccountTab = 'all';
  searchQuery = '';
  activeFilter = 'all';

  stats = [
    { label: 'إجمالي الحسابات', value: '٣٫٠٧٤', icon: 'database',   color: 'primary', valueColor: '#000'    },
    { label: 'نشط',             value: '٢٫٨٤٠', icon: 'circle-check', color: 'success', valueColor: '#16a34a' },
    { label: 'تحت المراجعة',   value: '٤٢',    icon: 'clock',        color: 'warning', valueColor: '#d97706' },
    { label: 'موقوف',           value: '١٩٢',   icon: 'circle-x',     color: 'danger',  valueColor: '#ef4444' },
  ];

  accounts: Account[] = [
    {
      id: '1', name: 'محمد بن علي العتيبي', type: 'individual', status: 'active',
      idNumber: '١-٢٩٣٨٧٥١', joinDate: '٥ مايو ٢٤', propertyCount: 3, unit: 'مقترات',
      avatarInitials: 'MA'
    },
    {
      id: '2', name: 'ضيافة الخليج', type: 'individual', status: 'active',
      idNumber: '١-٢٩٣٨٧٥١', joinDate: '٥ مارس ٢٤', propertyCount: 3, unit: 'مقترات',
      avatarInitials: 'MA'
    },
    {
      id: '3', name: 'مجموعة ريادة الفندقية', type: 'company', status: 'active',
      idNumber: '٢١٢٩٨٧', joinDate: '١٣ إبريل ٢٢', propertyCount: 13, unit: 'عقار',
      avatarInitials: 'MR', paymentBadge: 'stripe'
    },
    {
      id: '4', name: 'شركة المستقبل العقارية', type: 'company', status: 'rejected',
      idNumber: '٢٣٣٤٥', joinDate: '٨ أكتوبر ٢٢', propertyCount: 8, unit: 'عقار',
      avatarInitials: 'MF', tradeName: 'الاسم التجاري: المستقبل العقارية'
    },
    {
      id: '5', name: 'الأفق للاستثمار العقاري', type: 'company', status: 'under_review',
      idNumber: '٣٤٥٦٧', joinDate: '١٢ يناير ٢٣', propertyCount: 5, unit: 'عقار',
      avatarInitials: 'AH'
    },
    {
      id: '6', name: 'سارة محمد الغامدي', type: 'individual', status: 'suspended',
      idNumber: '٢-٤٥٦٧٨٩٠', joinDate: '٣ مارس ٢٣', propertyCount: 1, unit: 'مقترات',
      avatarInitials: 'SG'
    },
  ];

  get filteredAccounts(): Account[] {
    let list = this.accounts;

    if (this.activeTab === 'all') {
      // under_review لا تظهر في تاب الكل
      list = list.filter(a => a.status !== 'under_review');
    } else if (this.activeTab === 'active') {
      list = list.filter(a => a.status === 'active');
    } else if (this.activeTab === 'rejected') {
      list = list.filter(a => a.status === 'rejected');
    } else if (this.activeTab === 'under_review') {
      list = list.filter(a => a.status === 'under_review');
    }

    const q = this.searchQuery.trim();
    if (q) list = list.filter(a => a.name.includes(q) || a.idNumber.includes(q));

    return list;
  }

  setActiveTab(tab: AccountTab): void {
    this.activeTab = tab;
  }
}