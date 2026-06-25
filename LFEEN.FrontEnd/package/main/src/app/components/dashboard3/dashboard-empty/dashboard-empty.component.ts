import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-dashboard-empty',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './dashboard-empty.component.html',
  styleUrl: './dashboard-empty.component.scss'
})
export class DashboardEmptyComponent {
  /** Custom image URL — if provided the default SVG is hidden */
  @Input() imageSrc: string | null = null;
  @Input() titleKey = 'd3.emptyState.defaultTitle';
  @Input() descKey = 'd3.emptyState.defaultDesc';
}
