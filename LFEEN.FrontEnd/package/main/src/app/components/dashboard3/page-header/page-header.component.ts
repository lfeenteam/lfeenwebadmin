import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';

@Component({
  selector: 'app-dashboard3-page-header',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  @Input({ required: true }) titleKey!: string;
  @Input() breadcrumbKey = 'd3.header.platform';
  @Input() showLive = true;
  @Input() showDate = true;
  @Input() showBack = false;
  @Input() statusBadge: { text: string; color: string } | null = null;

  @Output() sidebarToggle = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();

  constructor(private translate: TranslateService) {}

  get dir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get isRtl(): boolean {
    return this.dir === 'rtl';
  }

  onSidebarToggle(event: Event): void {
    event.stopPropagation();
    this.sidebarToggle.emit();
  }

  onBack(event: Event): void {
    event.stopPropagation();
    this.back.emit();
  }
}
