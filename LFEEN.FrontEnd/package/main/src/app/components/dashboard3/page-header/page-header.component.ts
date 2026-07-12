import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PageBreadcrumbCrumb } from '../../../pages/dashboards/dashboard3/services/page-breadcrumb-trail.service';

@Component({
  selector: 'app-dashboard3-page-header',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule, TablerIconsModule],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  @Input({ required: true }) titleKey!: string;
  @Input() titleOverride: string | null = null;
  @Input() breadcrumbKey = 'd3.header.platform';
  @Input() breadcrumbRoute: string[] | null = null;
  @Input() breadcrumbQueryParams: Record<string, string> | null = null;
  @Input() extraCrumbs: PageBreadcrumbCrumb[] | null = null;
  @Input() showLive = true;
  @Input() showDate = true;
  @Input() showBack = false;
  @Input() statusBadge: { text: string; color: string } | null = null;
  @Input() actionButton: { text: string; icon?: string; color?: string; action: string } | null = null;

  @Output() sidebarToggle = new EventEmitter<void>();
  @Output() back = new EventEmitter<void>();
  @Output() action = new EventEmitter<string>();

  constructor(private translate: TranslateService) {}

  get dir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get isRtl(): boolean {
    return this.dir === 'rtl';
  }

  get currentDate(): string {
    const locale = this.translate.currentLang === 'en' ? 'en-US' : 'ar-EG';
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
  }

  onSidebarToggle(event: Event): void {
    event.stopPropagation();
    this.sidebarToggle.emit();
  }

  onBack(event: Event): void {
    event.stopPropagation();
    this.back.emit();
  }

  onAction(event: Event): void {
    event.stopPropagation();
    if (this.actionButton?.action) {
      this.action.emit(this.actionButton.action);
    }
  }
}
