import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subscription } from 'rxjs';
import { Employee } from '../../../../interfaces/department.model';

@Component({
  selector: 'app-all-employees',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './all-employees.component.html',
  styleUrl: './all-employees.component.scss'
})
export class AllEmployeesComponent implements OnInit, OnDestroy {
  @Input() employees: Employee[] = [];
  @Output() edit = new EventEmitter<Employee>();
  @Output() delete = new EventEmitter<Employee>();
  @Output() addEmployee = new EventEmitter<void>();

  displayedColumns: string[] = ['employee', 'phone', 'role', 'status', 'action'];
  private bpSub = new Subscription();

  constructor(private translate: TranslateService, private bp: BreakpointObserver) {}

  ngOnInit(): void {
    this.bpSub = this.bp.observe(['(max-width: 767px)', '(max-width: 992px)']).subscribe(result => {
      if (result.breakpoints['(max-width: 767px)']) {
        this.displayedColumns = ['employee', 'status', 'action'];
      } else if (result.breakpoints['(max-width: 992px)']) {
        this.displayedColumns = ['employee', 'role', 'status', 'action'];
      } else {
        this.displayedColumns = ['employee', 'phone', 'role', 'status', 'action'];
      }
    });
  }

  ngOnDestroy(): void {
    this.bpSub.unsubscribe();
  }

  onEdit(employee: Employee): void {
    this.edit.emit(employee);
  }

  onDelete(employee: Employee): void {
    this.delete.emit(employee);
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
