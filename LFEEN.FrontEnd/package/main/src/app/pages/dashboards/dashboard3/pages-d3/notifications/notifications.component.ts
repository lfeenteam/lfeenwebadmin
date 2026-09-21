import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';

export type NotificationTab = 'all' | 'complaints' | 'propertyReview' | 'inquiries';
export type NotificationType = 'complaint' | 'propertyReview' | 'inquiry';

export interface NotificationItem {
  id: string;
  refId: string;
  type: NotificationType;
  categoryLabel: string;
  title: string;
  subtitle: string;
  time: string;
}

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, TranslateModule, MaterialModule, TablerIconsModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent {
  activeTab = signal<NotificationTab>('all');

  readonly tabs: { key: NotificationTab; labelKey: string }[] = [
    { key: 'all',            labelKey: 'd3.notifications.tabs.all' },
    { key: 'complaints',     labelKey: 'd3.notifications.tabs.complaints' },
    { key: 'propertyReview', labelKey: 'd3.notifications.tabs.propertyReview' },
    { key: 'inquiries',      labelKey: 'd3.notifications.tabs.inquiries' },
  ];

  private allNotifications: NotificationItem[] = [
    {
      id: '1',
      refId: '#T-8842',
      type: 'complaint',
      categoryLabel: 'd3.notifications.types.complaint',
      title: 'd3.notifications.mock.complaint1.title',
      subtitle: 'd3.notifications.mock.complaint1.subtitle',
      time: 'd3.notifications.mock.complaint1.time',
    },
    {
      id: '2',
      refId: '#P-354',
      type: 'propertyReview',
      categoryLabel: 'd3.notifications.types.propertyReview',
      title: 'd3.notifications.mock.propertyReview1.title',
      subtitle: 'd3.notifications.mock.propertyReview1.subtitle',
      time: 'd3.notifications.mock.propertyReview1.time',
    },
    {
      id: '3',
      refId: '#Q-25',
      type: 'inquiry',
      categoryLabel: 'd3.notifications.types.inquiry',
      title: 'd3.notifications.mock.inquiry1.title',
      subtitle: 'd3.notifications.mock.inquiry1.subtitle',
      time: 'd3.notifications.mock.inquiry1.time',
    },
    {
      id: '4',
      refId: '#T-28000',
      type: 'complaint',
      categoryLabel: 'd3.notifications.types.complaint',
      title: 'd3.notifications.mock.complaint2.title',
      subtitle: 'd3.notifications.mock.complaint2.subtitle',
      time: 'd3.notifications.mock.complaint2.time',
    },
  ];

  visibleNotifications = computed(() => {
    const tab = this.activeTab();
    if (tab === 'all') return this.allNotifications;
    const typeMap: Record<NotificationTab, NotificationType | null> = {
      all: null,
      complaints: 'complaint',
      propertyReview: 'propertyReview',
      inquiries: 'inquiry',
    };
    const filterType = typeMap[tab];
    return this.allNotifications.filter(n => n.type === filterType);
  });

  constructor(private translate: TranslateService) {}

  setTab(tab: NotificationTab): void {
    this.activeTab.set(tab);
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  getIconName(type: NotificationType): string {
    if (type === 'complaint') return 'alert-circle';
    if (type === 'propertyReview') return 'building';
    return 'help-circle';
  }

  getIconClass(type: NotificationType): string {
    if (type === 'complaint') return 'icon-complaint';
    if (type === 'propertyReview') return 'icon-property';
    return 'icon-inquiry';
  }
}
