import { Component, HostListener, Input, Output, EventEmitter, computed, inject, signal } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { CoreService } from 'src/app/services/core.service';
import { appLocale } from 'src/app/utils/locale-format.util';
import { D3IconComponent } from '../d3-icon/d3-icon.component';
import { HeaderActionsComponent } from '../header-actions/header-actions.component';

/**
 * Executive dashboard header: page title + today's date + connection status on the start
 * side; the shared account cluster (notifications, language, account) on the end side.
 */
@Component({
  selector: 'app-dashboard3-header',
  standalone: true,
  imports: [MaterialModule, CommonModule, TranslateModule, D3IconComponent, HeaderActionsComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  private readonly settings = inject(CoreService);

  /** Browser connectivity (navigator.onLine + online/offline events) — a real signal, not a fixed badge. */
  readonly isOnline = signal(typeof navigator === 'undefined' ? true : navigator.onLine);

  /** Whether the mobile sidebar drawer is open — drives the ☰ button's aria-expanded. */
  @Input() sidebarOpen = false;
  @Output() sidebarToggle = new EventEmitter<void>();

  private readonly lang = computed(() => this.settings.getOptionsSignal()().language);
  readonly isRtl = computed(() => this.lang() !== 'en');

  get currentDate(): string {
    const locale = appLocale(this.lang() === 'en' ? 'en' : 'ar');
    return new Intl.DateTimeFormat(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date());
  }

  onSidebarToggle(event: Event): void {
    event.stopPropagation();
    this.sidebarToggle.emit();
  }

  @HostListener('window:online')
  onOnline(): void {
    this.isOnline.set(true);
  }

  @HostListener('window:offline')
  onOffline(): void {
    this.isOnline.set(false);
  }
}
