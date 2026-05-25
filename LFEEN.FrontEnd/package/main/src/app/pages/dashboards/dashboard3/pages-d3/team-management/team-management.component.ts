import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { RouterModule } from '@angular/router';

interface Department {
  id: number;
  name: string;
  description: string;
  manager: string;
  employeeCount: number;
  status: 'active' | 'inactive';
  icon: string;
}

@Component({
  selector: 'app-team-management',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, RouterModule],
  templateUrl: './team-management.component.html',
  styleUrl: './team-management.component.scss'
})
export class TeamManagementComponent {
  stats = [
    { label: 'إجمالي الموظفين', value: 156, icon: 'assets/images/svgs/Group.svg', color: 'primary', valueColor: '#000' },
    { label: 'عدد الأقسام', value: 8, icon: 'assets/images/svgs/Group (1).svg', color: 'accent', valueColor: '#000' },
    { label: 'المدراء النشطون', value: 12, icon: 'assets/images/svgs/Group (2).svg', color: 'success', valueColor: '#16a34a' },
    { label: 'قيد التفعيل', value: 5, icon: 'assets/images/svgs/Group (3).svg', color: 'warning', valueColor: '#d97706' }
  ];

  departments: Department[] = [
    {
      id: 1,
      name: 'قسم التشغيل',
      description: 'إدارة الحجوزات اليومية والتنسيق الفني بين المضيفين والضيوف لضمان أعلى جودة.',
      manager: 'فهد السيف',
      employeeCount: 12,
      status: 'active',
      icon: 'briefcase'
    },
    {
      id: 2,
      name: 'خدمة العملاء',
      description: 'الرد على استفسارات المستخدمين، حل النزاعات، وتقديم الدعم الفوري على مدار الساعة.',
      manager: 'ريم العبدالله',
      employeeCount: 24,
      status: 'active',
      icon: 'headset'
    },
    {
      id: 3,
      name: 'تقنية المعلومات',
      description: 'تطوير المنصة حماية البيانات، وإدارة البنية التحتية السحابية للتطبيق.',
      manager: 'ياسر الحربي',
      employeeCount: 8,
      status: 'active',
      icon: 'code'
    }
  ];
}
