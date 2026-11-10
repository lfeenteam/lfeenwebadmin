import { AfterViewInit, Component, DestroyRef, ElementRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { ControlCenterSummary, ControlCenterTab, SummaryPlatform } from './interfaces/control-center.model';
import { parseControlCenterError } from './interfaces/control-center-error.util';
import { formatRiyadh } from './interfaces/riyadh-time.util';
import { ControlCenterService } from './services/control-center.service';
import { AppUpdatesComponent } from './app-updates/app-updates.component';
import { MaintenanceComponent } from './maintenance/maintenance.component';
import { SeasonalThemesComponent } from './seasonal-themes/seasonal-themes.component';

/**
 * Control Center page: summary cards + platform status (GET /summary) above three tabs,
 * each its own component. Every successful save in a tab reloads the summary.
 */
@Component({
  selector: 'app-control-center',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent, AppUpdatesComponent, MaintenanceComponent, SeasonalThemesComponent],
  templateUrl: './control-center.component.html',
  styleUrl: './control-center.component.scss'
})
export class ControlCenterComponent implements OnInit, AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private service = inject(ControlCenterService);

  @ViewChild('tabsNav') private tabsNav?: ElementRef<HTMLElement>;
  /** More tabs hidden past the start / end edge — drives the arrow cues on narrow screens. */
  canScrollStart = false;
  canScrollEnd = false;

  currentLang = this.translate.currentLang || 'ar';
  activeTab: ControlCenterTab = 'maintenance';

  summary: ControlCenterSummary | null = null;
  summaryError: string | null = null;
  private summaryRequest?: Subscription;

  readonly tabs: { value: ControlCenterTab; labelKey: string; icon: string }[] = [
    { value: 'maintenance', labelKey: 'd3.controlCenter.tabs.maintenance', icon: 'tool' },
    { value: 'updates', labelKey: 'd3.controlCenter.tabs.updates', icon: 'download' },
    { value: 'themes', labelKey: 'd3.controlCenter.tabs.themes', icon: 'palette' },
  ];

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        this.currentLang = event.lang;
        // Label widths change with the language.
        setTimeout(() => this.updateTabsScroll());
      });
  }

  ngOnInit(): void {
    this.loadSummary();
  }

  ngAfterViewInit(): void {
    // Tab labels come from translations, so measure after they've rendered.
    setTimeout(() => this.updateTabsScroll());
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  fmt(value: number): string {
    return formatLocalizedNumber(value, this.currentLang);
  }

  // ── Summary ─────────────────────────────────────────────────

  loadSummary(): void {
    this.summaryRequest?.unsubscribe();
    this.summaryError = null;
    this.summaryRequest = this.service.getSummary().subscribe({
      next: summary => { this.summary = summary; },
      error: err => {
        this.summary = null;
        this.summaryError = parseControlCenterError(err, this.translate).message;
      },
    });
  }

  /** The design covers the client and merchant apps on Android + iOS only. */
  get platforms(): SummaryPlatform[] {
    return (this.summary?.platforms ?? []).filter(
      p => (p.app === 'Client' || p.app === 'Host') && (p.platform === 'Android' || p.platform === 'Ios'),
    );
  }

  trackPlatform(p: SummaryPlatform): string {
    return `${p.app}-${p.platform}`;
  }

  statusKey(p: SummaryPlatform): string {
    return `d3.controlCenter.status.${p.status}`;
  }

  scheduledAt(p: SummaryPlatform): string | null {
    return p.status === 'MaintenanceScheduled' && p.maintenanceStartsAtUtc
      ? formatRiyadh(p.maintenanceStartsAtUtc, this.currentLang)
      : null;
  }

  get lastUpdatedLabel(): string | null {
    return this.summary?.lastUpdatedAtUtc ? formatRiyadh(this.summary.lastUpdatedAtUtc, this.currentLang) : null;
  }

  // ── Tabs ────────────────────────────────────────────────────

  setActiveTab(tab: ControlCenterTab, event?: Event): void {
    this.activeTab = tab;
    // Bring a half-hidden tab fully into view once picked.
    (event?.currentTarget as HTMLElement | undefined)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  @HostListener('window:resize')
  updateTabsScroll(): void {
    const nav = this.tabsNav?.nativeElement;
    if (!nav) return;
    // In RTL scrollLeft runs 0 → negative, so work with its magnitude.
    const scrolled = Math.abs(nav.scrollLeft);
    this.canScrollStart = scrolled > 1;
    this.canScrollEnd = scrolled + nav.clientWidth < nav.scrollWidth - 1;
  }

  scrollTabs(toward: 'start' | 'end'): void {
    const nav = this.tabsNav?.nativeElement;
    if (!nav) return;
    const step = nav.clientWidth * 0.6;
    const sign = (toward === 'end' ? 1 : -1) * (this.currentDir === 'rtl' ? -1 : 1);
    nav.scrollBy({ left: sign * step, behavior: 'smooth' });
  }
}
