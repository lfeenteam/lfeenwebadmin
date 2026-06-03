import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

interface PermissionItem {
  key: string;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
}

@Component({
  selector: 'app-add-department',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './add-department.component.html',
  styleUrl: './add-department.component.scss'
})
export class AddDepartmentComponent {
  nameControl = new FormControl('');
  descriptionControl = new FormControl('');

  permissions: PermissionItem[] = [
    {
      key: 'dashboard',
      title: 'لوحة التحكم',
      description: 'الوصول لتحديثات الأنشطة وأرصدة الذكاء',
      icon: 'layout-grid',
      enabled: true
    },
    {
      key: 'buildings',
      title: 'إدارة المباني',
      description: 'مراجعة قائمة المباني واعتماد الإيجارات الجديدة',
      icon: 'building',
      enabled: true
    },
    {
      key: 'units',
      title: 'إدارة الوحدات',
      description: 'التحكم في خصائص الوحدات والرسوم المالية للذكاء',
      icon: 'home',
      enabled: true
    },
    {
      key: 'reservations',
      title: 'الحجوزات',
      description: 'متابعة الحجوزات المفتوحة وإدارة طلبات الإلغاء',
      icon: 'calendar-event',
      enabled: true
    },
    {
      key: 'guests',
      title: 'الضيوف',
      description: 'الوصول لبيانات الضيوف ومؤسسات المباني',
      icon: 'users',
      enabled: false
    },
    {
      key: 'hosts',
      title: 'المضيفون',
      description: 'إدارة حسابات المضيفين وصيانة ملفاتهم المالية',
      icon: 'user-check',
      enabled: false
    },
    {
      key: 'revenue',
      title: 'الإيرادات',
      description: 'مراقبة الطلبات المجدولة وخصوصية المعلومات المالية',
      icon: 'chart-bar',
      enabled: false
    },
    {
      key: 'reports',
      title: 'التقارير',
      description: 'تقييم التقارير التفصيلية والمالية لكافة المباني',
      icon: 'file-analytics',
      enabled: false
    },
    {
      key: 'complaints',
      title: 'الشكاوى',
      description: 'الوصول لمسائل الدعم الفني للمستخدمين',
      icon: 'message-dots',
      enabled: false
    },
    {
      key: 'cities',
      title: 'المدن',
      description: 'إدارة تفاصيل المدن وفروع المسؤولية المختلفة',
      icon: 'map-pin',
      enabled: false
    },
    {
      key: 'team',
      title: 'إدارة الفرق',
      description: 'صلاحية إضافة موظفين جدد وتغيير مجرى القسم',
      icon: 'users-group',
      enabled: false
    },
    {
      key: 'settings',
      title: 'الإعدادات',
      description: 'ضبط إعدادات النظام ومتطلبات التشغيل الآلي',
      icon: 'settings',
      enabled: false
    },
  ];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private translate: TranslateService
  ) {}

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  enableAll(): void {
    this.permissions.forEach(p => p.enabled = true);
  }

  disableAll(): void {
    this.permissions.forEach(p => p.enabled = false);
  }

  save(): void {
    console.log({
      name: this.nameControl.value,
      description: this.descriptionControl.value,
      permissions: this.permissions.filter(p => p.enabled).map(p => p.key)
    });
    this.router.navigate(['../'], { relativeTo: this.route });
  }

  cancel(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
