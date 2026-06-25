import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-dashboard-loading',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-loading.component.html',
  styleUrl: './dashboard-loading.component.scss'
})
export class DashboardLoadingComponent {
  @Input() rows = 3;
  @Input() variant: 'cards' | 'review' | 'table' = 'cards';
}
