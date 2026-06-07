import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { Department } from '../../../../interfaces/department.model';

@Component({
  selector: 'app-manager-card',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './manager-card.component.html',
  styleUrl: './manager-card.component.scss'
})
export class ManagerCardComponent {
  @Input() department!: Department;
  @Input() currentLang = 'ar';
  @Output() addEmployee = new EventEmitter<void>();
}
