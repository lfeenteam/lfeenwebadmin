import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';

interface Permission {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
  icon: string;
}

@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, FormsModule, RouterModule],
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss'
})
export class PermissionsComponent {
  deptId: string | null = null;
  deptName = 'قسم التشغيل';
  deptEnglishName = 'Operations';
  manager = 'فهد السيف';
  employeeCount = 12;

  permissions: Permission[] = [
    {
      id: 1,
      name: 'لوحة التحكم',
      description: 'الوصول للرسوم البيانية والملخص العام للأداء المالي والتشغيلي.',
      enabled: true,
      icon: 'layout-grid'
    },
    {
      id: 2,
      name: 'إدارة المباني',
      description: 'مراجعة وثائق المباني المرفوعة من المضيفين وقبولها أو رفضها.',
      enabled: true,
      icon: 'building'
    },
    {
      id: 3,
      name: 'إدارة الوحدات',
      description: 'إدارة تفاصيل الغرف والأجنحة تحديث السمة وتعديل المواصفات الداخلية.',
      enabled: true,
      icon: 'home'
    },
    {
      id: 4,
      name: 'الحجوزات',
      description: 'مراقبة جدول الحجوزات تحديث حالات الدفع وإدارة عمليات الإلغاء.',
      enabled: true,
      icon: 'calendar-event'
    },
    {
      id: 5,
      name: 'إدارة الشكاوى',
      description: 'الوصول لرسائل العملاء والشكاوى الفنية المرفوعة ضد المضيفين.',
      enabled: false,
      icon: 'message-dots'
    },
    {
      id: 6,
      name: 'إدارة الفريق',
      description: 'صلاحية تسجيل أدوار الموظفين وتعديل صلاحيات الوصول للأقسام.',
      enabled: false,
      icon: 'users'
    }
  ];

  constructor(private route: ActivatedRoute) {
    this.deptId = this.route.snapshot.paramMap.get('id');
  }

  savePermissions(): void {
    console.log('Permissions saved:', this.permissions);
  }

  cancelChanges(): void {
    // Reset permissions or navigate back
  }
}
