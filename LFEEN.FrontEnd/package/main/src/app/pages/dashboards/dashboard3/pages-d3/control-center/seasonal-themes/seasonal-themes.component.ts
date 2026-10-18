import { Component, DestroyRef, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { SeasonalTheme, ThemeStatus, themeStatus, todayIsoDate } from '../interfaces/control-center.model';
import { ControlCenterService } from '../services/control-center.service';
import { ThemeFormDrawerComponent } from './theme-form-drawer/theme-form-drawer.component';

@Component({
  selector: 'app-control-center-themes',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent, ThemeFormDrawerComponent],
  templateUrl: './seasonal-themes.component.html',
  styleUrl: './seasonal-themes.component.scss'
})
export class SeasonalThemesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private service = inject(ControlCenterService);

  /** Fires after a create/edit, so the page can refresh its theme counters. */
  @Output() changed = new EventEmitter<void>();

  currentLang = this.translate.currentLang || 'ar';
  themes: SeasonalTheme[] = [];
  loading = false;
  loadError = false;

  drawerOpen = false;
  /** Theme being edited; null while creating. */
  editing: SeasonalTheme | null = null;

  private request?: Subscription;

  constructor() {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => { this.currentLang = event.lang; });
  }

  ngOnInit(): void {
    this.load();
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading = true;
    this.loadError = false;
    this.request = this.service.getThemes().subscribe({
      next: themes => {
        this.themes = themes;
        this.loading = false;
      },
      error: () => {
        this.themes = [];
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  status(theme: SeasonalTheme): ThemeStatus {
    return themeStatus(theme, todayIsoDate());
  }

  /** The uploaded banner wins; otherwise a diagonal blend of the two theme colours. */
  bannerBackground(theme: SeasonalTheme): string {
    return theme.bannerUrl
      ? `center / cover no-repeat url("${encodeURI(theme.bannerUrl).replace(/"/g, '%22')}")`
      : `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`;
  }

  /** "01 مارس – 31 مارس"; the year is added only when the window crosses years. */
  dateRange(theme: SeasonalTheme): string {
    const locale = this.currentDir === 'rtl' ? 'ar-SA-u-nu-latn' : 'en-US';
    const parse = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    const crossesYear = theme.startDate.slice(0, 4) !== theme.endDate.slice(0, 4);
    const fmt = new Intl.DateTimeFormat(locale, {
      day: '2-digit', month: 'long', calendar: 'gregory', ...(crossesYear ? { year: 'numeric' } : {}),
    });
    return `${fmt.format(parse(theme.startDate))} – ${fmt.format(parse(theme.endDate))}`;
  }

  openCreate(): void {
    this.editing = null;
    this.drawerOpen = true;
  }

  openEdit(theme: SeasonalTheme): void {
    this.editing = theme;
    this.drawerOpen = true;
  }

  onSaved(): void {
    this.drawerOpen = false;
    this.editing = null;
    this.load();
    this.changed.emit();
  }

  onDrawerClosed(): void {
    this.drawerOpen = false;
    this.editing = null;
  }
}
