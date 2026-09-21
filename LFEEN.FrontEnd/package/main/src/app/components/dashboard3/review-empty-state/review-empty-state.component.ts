import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-review-empty-state',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule],
  templateUrl: './review-empty-state.component.html',
  styleUrl: './review-empty-state.component.scss'
})
export class ReviewEmptyStateComponent {
  @Input() icon = 'file-off';
  @Input() titleKey = '';
  @Input() descKey = '';
}
