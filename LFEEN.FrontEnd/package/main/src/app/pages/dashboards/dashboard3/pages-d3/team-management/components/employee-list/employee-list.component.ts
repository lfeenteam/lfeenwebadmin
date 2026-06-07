import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AllEmployeesComponent } from '../all-employees/all-employees.component';
import { Employee } from '../../../../interfaces/department.model';

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
  @Input() totalPages = 1;
  @Input() currentPage = 1;
  @Input() totalCount = 0;

  @Output() edit = new EventEmitter<Employee>();
  @Output() delete = new EventEmitter<Employee>();
  @Output() pageChange = new EventEmitter<number>();

  searchQuery = '';

  constructor(private translate: TranslateService) {}

  get filteredEmployees(): Employee[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.employees;
    return this.employees.filter(e =>
      e.fullName?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.phoneNumber?.toLowerCase().includes(q) ||
      e.roles?.some(r =>
        r.nameAr?.toLowerCase().includes(q) ||
        r.nameEn?.toLowerCase().includes(q) ||
        r.name?.toLowerCase().includes(q)
      )
    );
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  onEdit(employee: Employee): void {
    this.edit.emit(employee);
  }

  onDelete(employee: Employee): void {
    this.delete.emit(employee);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.pageChange.emit(page);
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }
}
