import { Component, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { AllEmployeesComponent } from '../all-employees/all-employees.component';
import { Employee } from '../../../../interfaces/department.model';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, TablerIconsModule, TranslateModule, AllEmployeesComponent],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.scss'
})
export class EmployeeListComponent implements OnDestroy {
  @Input() employees: Employee[] = [];
  @Input() title: string = '';
  @Input() showHeader: boolean = true;
  @Input() totalPages = 1;
  @Input() currentPage = 1;
  @Input() totalCount = 0;

  @Output() edit = new EventEmitter<Employee>();
  @Output() delete = new EventEmitter<Employee>();
  @Output() toggleStatus = new EventEmitter<Employee>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() addEmployee = new EventEmitter<void>();

  searchQuery = '';

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(private translate: TranslateService) {
    this.searchSubject.pipe(
      debounceTime(300),
      takeUntil(this.destroy$)
    ).subscribe(q => this.searchChange.emit(q));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(query: string): void {
    this.searchSubject.next(query);
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

  onToggleStatus(employee: Employee): void {
    this.toggleStatus.emit(employee);
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.pageChange.emit(page);
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ar';
  }
}
