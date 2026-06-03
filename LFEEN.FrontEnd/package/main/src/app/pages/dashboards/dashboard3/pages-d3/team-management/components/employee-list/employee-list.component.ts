import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AllEmployeesComponent } from '../all-employees/all-employees.component';
import { Employee } from '../../department.service';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule, AllEmployeesComponent],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.scss'
})
export class EmployeeListComponent {
  @Input() employees: Employee[] = [];
  @Input() title: string = '';
  @Input() showHeader: boolean = true;

  @Output() edit = new EventEmitter<Employee>();
  @Output() delete = new EventEmitter<Employee>();

  searchQuery = '';

  constructor(private translate: TranslateService) {}

  get filteredEmployees(): Employee[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.employees;
    return this.employees.filter(e =>
      e.fullName?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.phoneNumber?.toLowerCase().includes(q) ||
      e.roles?.some(r => r.nameAr?.toLowerCase().includes(q) || r.nameEn?.toLowerCase().includes(q))
    );
  }

  onEdit(employee: Employee): void {
    this.edit.emit(employee);
  }

  onDelete(employee: Employee): void {
    this.delete.emit(employee);
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }
}
