import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { RouterModule } from '@angular/router';
import { DepartmentService, Department } from './department.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-team-management',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, RouterModule, TranslateModule],
  templateUrl: './team-management.component.html',
  styleUrl: './team-management.component.scss'
})
export class TeamManagementComponent implements OnInit {
  stats = [
    { label: 'd3.teamManagement.stats.totalEmployees', value: 0, icon: 'assets/images/svgs/Group.svg', color: 'primary', valueColor: '#000' },
    { label: 'd3.teamManagement.stats.departmentCount', value: 0, icon: 'assets/images/svgs/Group (1).svg', color: 'accent', valueColor: '#000' },
    { label: 'd3.teamManagement.stats.activeManagers', value: 12, icon: 'assets/images/svgs/Group (2).svg', color: 'success', valueColor: '#16a34a' },
    { label: 'd3.teamManagement.stats.pendingActivation', value: 5, icon: 'assets/images/svgs/Group (3).svg', color: 'warning', valueColor: '#d97706' }
  ];

  departments: Department[] = [];

  iconMap: { [key: string]: string } = {
    'CS': 'headset',
    'IT': 'code',
    'OPS': 'briefcase',
    'TECH': 'settings'
  };

  constructor(
    private departmentService: DepartmentService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.departmentService.getDepartments().subscribe({
      next: (data) => {
        this.departments = data;
        // Update stats if needed based on API data
        this.stats[0].value = data.reduce((sum, d) => sum + d.employeeCount, 0);
        this.stats[1].value = data.length;
      },
      error: (err) => console.error('Error fetching departments', err)
    });
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }
}
