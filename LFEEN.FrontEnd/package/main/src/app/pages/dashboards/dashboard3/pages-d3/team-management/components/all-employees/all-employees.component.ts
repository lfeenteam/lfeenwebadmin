import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { Employee } from '../../../../interfaces/department.model';

@Component({
  selector: 'app-all-employees',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent],
  templateUrl: './all-employees.component.html',
  styleUrl: './all-employees.component.scss'
})
export class AllEmployeesComponent {
  @Input() employees: Employee[] = [];
  /** A search or filter is applied, so an empty table means "no matches", not "no employees". */
  @Input() hasFilters = false;
  @Output() clearFilters = new EventEmitter<void>();
  @Output() edit = new EventEmitter<Employee>();
  @Output() delete = new EventEmitter<Employee>();
  @Output() toggleStatus = new EventEmitter<Employee>();
  @Output() addEmployee = new EventEmitter<void>();

  displayedColumns: string[] = ['employee', 'phone', 'role', 'status', 'action'];

  constructor(private translate: TranslateService) {}

  onEdit(employee: Employee): void {
    this.edit.emit(employee);
  }

  onDelete(employee: Employee): void {
    this.delete.emit(employee);
  }

  onToggleStatus(employee: Employee): void {
    this.toggleStatus.emit(employee);
  }

  onAddEmployee(): void {
    this.addEmployee.emit();
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  getDepartmentName(employee: Employee): string {
    return (this.currentLang === 'ar' ? employee.departmentNameAr : employee.departmentNameEn)
      || employee.departmentName
      || '---';
  }

  getRoleName(employee: Employee): string {
    const role = employee.roles?.[0];
    return (this.currentLang === 'ar' ? role?.nameAr : role?.nameEn)
      || role?.name
      || '---';
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }
}
