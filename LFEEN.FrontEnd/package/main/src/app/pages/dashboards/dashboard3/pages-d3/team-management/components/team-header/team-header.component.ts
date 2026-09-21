import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { Department, DepartmentRole } from '../../../../interfaces/department.model';

@Component({
  selector: 'app-team-header',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, FormsModule],
  templateUrl: './team-header.component.html',
  styleUrl: './team-header.component.scss'
})
export class TeamHeaderComponent {
  @Input() actionLabel: string = 'd3.teamManagement.addDept';
  @Input() actionIcon: string = 'plus';
  @Input() showFilters: boolean = false;
  @Input() isBoxed: boolean = false;
  @Input() showAction: boolean = true;
  @Input() departments: Department[] = [];
  @Input() roles: DepartmentRole[] = [];

  @Output() search = new EventEmitter<string>();
  @Output() filterDept = new EventEmitter<string>();
  @Output() filterRole = new EventEmitter<string>();
  @Output() action = new EventEmitter<void>();

  searchQuery: string = '';

  constructor(private translate: TranslateService) {}

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }

  onSearchChange() {
    this.search.emit(this.searchQuery);
  }

  onDeptFilterChange(value: string) {
    this.filterDept.emit(value);
  }

  onRoleFilterChange(value: string) {
    this.filterRole.emit(value);
  }

  getDepartmentName(department: Department): string {
    return (this.currentLang === 'ar' ? department.nameAr : department.nameEn)
      || department.name
      || '---';
  }

  getRoleName(role: DepartmentRole): string {
    return (this.currentLang === 'ar' ? role.nameAr : role.nameEn)
      || role.name
      || '---';
  }

  onAction() {
    this.action.emit();
  }
}
