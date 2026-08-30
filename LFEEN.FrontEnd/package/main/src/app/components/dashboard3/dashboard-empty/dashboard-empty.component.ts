import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-dashboard-empty',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule],
  templateUrl: './dashboard-empty.component.html',
  styleUrl: './dashboard-empty.component.scss'
})
export class DashboardEmptyComponent {
  /** Custom image URL — takes priority over everything else */
  @Input() imageSrc: string | null = null;
  /** Tabler icon name — shown instead of the default building illustration when set */
  @Input() icon: string | null = null;
  @Input() titleKey = 'd3.emptyState.defaultTitle';
  @Input() descKey = 'd3.emptyState.defaultDesc';
}
