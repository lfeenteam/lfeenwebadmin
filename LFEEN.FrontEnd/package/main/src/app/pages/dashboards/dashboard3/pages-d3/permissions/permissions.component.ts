import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DepartmentService } from '../team-management/department.service';
import { TranslateService } from '@ngx-translate/core';

interface Permission {
  id: string;
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
export class PermissionsComponent implements OnInit {
  deptId: string | null = null;
  deptName = '';
  deptEnglishName = '';
  manager = '';
  employeeCount = 0;
  isLoading = true;

  permissions: Permission[] = [];

  constructor(
    private route: ActivatedRoute,
    private departmentService: DepartmentService,
    private translate: TranslateService
  ) {
    this.deptId = this.route.snapshot.paramMap.get('id');
  }

  ngOnInit(): void {
    if (this.deptId) {
      this.loadDepartment(this.deptId);
      this.loadRoles(this.deptId);
    }
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  private loadDepartment(id: string): void {
    this.departmentService.getDepartmentById(id).subscribe({
      next: (dept) => {
        this.deptName = dept.nameAr;
        this.deptEnglishName = dept.nameEn;
        this.manager = dept.managerFullName || '---';
        this.employeeCount = dept.employeeCount;
      },
      error: (err) => console.error('Error loading department', err)
    });
  }

  private loadRoles(id: string): void {
    this.departmentService.getDepartmentRoles(id).subscribe({
      next: (roles) => {
        this.permissions = roles.map(role => ({
          id: role.id,
          name: this.currentLang === 'ar' ? role.nameAr : role.nameEn,
          description: this.currentLang === 'ar' ? role.descriptionAr : role.descriptionEn,
          enabled: true,
          icon: 'user-circle'
        }));
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading roles', err);
        this.isLoading = false;
      }
    });
  }

  savePermissions(): void {
    console.log('Permissions saved:', this.permissions);
  }

  cancelChanges(): void {
    // Reset permissions or navigate back
  }
}
