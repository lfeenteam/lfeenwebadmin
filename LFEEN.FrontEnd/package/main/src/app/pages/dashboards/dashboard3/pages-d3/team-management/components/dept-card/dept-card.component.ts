import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Department } from '../../department.service';

@Component({
  selector: 'app-dept-card',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, RouterModule, TranslateModule],
  templateUrl: './dept-card.component.html',
  styleUrl: './dept-card.component.scss'
})
export class DeptCardComponent {
  @Input() dept!: Department;
  @Input() iconMap: { [key: string]: string } = {};
  @Input() currentLang = 'ar';
}
