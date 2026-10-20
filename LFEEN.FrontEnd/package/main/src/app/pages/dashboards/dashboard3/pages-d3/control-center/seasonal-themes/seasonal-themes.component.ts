import { Component, DestroyRef, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MaterialModule } from 'src/app/material.module';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription, filter } from 'rxjs';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { LoginService } from '../../../services/login/login.service';
import { OfferConfirmDialogComponent, OfferConfirmDialogData } from '../../platform-offers/components/offer-confirm-dialog/offer-confirm-dialog.component';
import { SeasonalTheme } from '../interfaces/control-center.model';
import { parseControlCenterError } from '../interfaces/control-center-error.util';
import { APP_RUNTIME_PERMISSIONS, hasAppRuntimePermission } from '../interfaces/control-center-permissions';
import { ControlCenterService } from '../services/control-center.service';
import { ThemeFormDrawerComponent } from './theme-form-drawer/theme-form-drawer.component';

@Component({
  selector: 'app-control-center-themes',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule, DashboardEmptyComponent, DashboardLoadingComponent, ThemeFormDrawerComponent],
  templateUrl: './seasonal-themes.component.html',
  styleUrl: './seasonal-themes.component.scss'
})
export class SeasonalThemesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private dialog = inject(MatDialog);
  private login = inject(LoginService);
  private service = inject(ControlCenterService);

  /** Fires after anything that changes the theme counters, so the page refreshes its summary. */
  @Output() changed = new EventEmitter<void>();

  currentLang = this.translate.currentLang || 'ar';
  themes: SeasonalTheme[] = [];
  loading = false;
  loadError: string | null = null;

  /** Theme with an action in flight — its controls are disabled meanwhile. */
  busyId: string | null = null;

  dialogOpen = false;
  /** Theme being edited; null while creating. */
  editingId: string | null = null;

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

  get canManage(): boolean {
    return hasAppRuntimePermission(this.login, APP_RUNTIME_PERMISSIONS.manageThemes);
  }

  get pendingCount(): number {
    return this.themes.filter(t => t.status === 'PendingReview').length;
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading = true;
    this.loadError = null;
    this.request = this.service.getThemes().subscribe({
      next: themes => {
        this.themes = themes;
        this.loading = false;
      },
      error: err => {
        this.themes = [];
        this.loading = false;
        this.loadError = parseControlCenterError(err, this.translate).message;
      },
    });
  }

  // ── Card display ────────────────────────────────────────────

  appLabelKey(theme: SeasonalTheme): string {
    return theme.app ? `d3.controlCenter.apps.${theme.app}` : 'd3.controlCenter.apps.all';
  }

  private primary(theme: SeasonalTheme): string {
    return theme.colors?.primary || '#111110';
  }

  private secondary(theme: SeasonalTheme): string {
    return theme.colors?.secondary || this.primary(theme);
  }

  /** The banner image wins; otherwise a diagonal blend of the two theme colours. */
  bannerBackground(theme: SeasonalTheme): string {
    if (theme.bannerUrl) return `center / cover no-repeat url("${encodeURI(theme.bannerUrl).replace(/"/g, '%22')}")`;
    return `linear-gradient(135deg, ${this.toCss(this.primary(theme))} 0%, ${this.toCss(this.secondary(theme))} 100%)`;
  }

  dotColor(theme: SeasonalTheme, which: 'primary' | 'secondary'): string {
    return this.toCss(which === 'primary' ? this.primary(theme) : this.secondary(theme));
  }

  /** The API allows #AARRGGBB; CSS wants the alpha last. */
  private toCss(hex: string): string {
    return /^#[0-9A-Fa-f]{8}$/.test(hex) ? `#${hex.slice(3)}${hex.slice(1, 3)}` : hex;
  }

  /** "01 مارس – 31 مارس"; the year shows only when the window crosses years. Days are Saudi days. */
  dateRange(theme: SeasonalTheme): string {
    const locale = this.currentDir === 'rtl' ? 'ar-SA-u-nu-latn' : 'en-US';
    const parse = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    };
    const crossesYear = theme.startDate.slice(0, 4) !== theme.endDate.slice(0, 4);
    const fmt = new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC', day: '2-digit', month: 'long', calendar: 'gregory', ...(crossesYear ? { year: 'numeric' } : {}),
    });
    return `${fmt.format(parse(theme.startDate))} – ${fmt.format(parse(theme.endDate))}`;
  }

  // ── Create / edit ───────────────────────────────────────────

  openCreate(): void {
    this.editingId = null;
    this.dialogOpen = true;
  }

  openEdit(theme: SeasonalTheme): void {
    this.editingId = theme.id;
    this.dialogOpen = true;
  }

  onSaved(theme: SeasonalTheme): void {
    this.dialogOpen = false;
    this.replace(theme, true);
    this.changed.emit();
  }

  onDialogClosed(): void {
    this.dialogOpen = false;
    this.editingId = null;
  }

  /** The edited theme vanished under us (404) — refresh the list. */
  onThemeMissing(): void {
    this.dialogOpen = false;
    this.editingId = null;
    this.load();
  }

  // ── Card actions ────────────────────────────────────────────

  toggleActive(theme: SeasonalTheme, event: MatSlideToggleChange): void {
    const isActive = event.checked;
    if (this.busyId) {
      event.source.checked = !isActive;
      return;
    }
    this.run(theme, this.service.setThemeActive(theme.id, isActive),
      isActive ? 'd3.controlCenter.themes.activated' : 'd3.controlCenter.themes.deactivated',
      // The binding didn't change, so put the switch back by hand.
      () => { event.source.checked = !isActive; });
  }

  approve(theme: SeasonalTheme): void {
    this.confirm({
      title: 'd3.controlCenter.themes.approveConfirm.title',
      message: this.translate.instant('d3.controlCenter.themes.approveConfirm.message', { name: theme.nameAr }),
      confirmLabel: 'd3.controlCenter.themes.approve',
      icon: 'circle-check',
      tone: 'success',
    }).subscribe(() => this.run(theme, this.service.approveTheme(theme.id), 'd3.controlCenter.themes.approveSuccess'));
  }

  shift(theme: SeasonalTheme, days: number): void {
    this.run(theme, this.service.shiftTheme(theme.id, days),
      days < 0 ? 'd3.controlCenter.themes.shiftEarlierSuccess' : 'd3.controlCenter.themes.shiftLaterSuccess');
  }

  remove(theme: SeasonalTheme): void {
    this.confirm({
      title: 'd3.controlCenter.themes.deleteConfirm.title',
      message: this.translate.instant('d3.controlCenter.themes.deleteConfirm.message', { name: theme.nameAr }),
      confirmLabel: 'd3.controlCenter.themes.delete',
      icon: 'trash',
      tone: 'danger',
    }).subscribe(() => {
      this.busyId = theme.id;
      this.service.deleteTheme(theme.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.busyId = null;
          this.themes = this.themes.filter(t => t.id !== theme.id);
          this.toastr.success(this.translate.instant('d3.controlCenter.themes.deleteSuccess'));
          this.changed.emit();
        },
        error: err => this.onActionError(err),
      });
    });
  }

  private confirm(data: OfferConfirmDialogData): Observable<boolean> {
    return this.dialog.open(OfferConfirmDialogComponent, { width: '420px', data })
      .afterClosed()
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef));
  }

  /** Runs an action that answers with the updated theme, then swaps it into the list. */
  private run(theme: SeasonalTheme, action$: Observable<SeasonalTheme>, successKey: string, onError?: () => void): void {
    if (this.busyId) return;
    this.busyId = theme.id;
    action$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: updated => {
        this.busyId = null;
        this.replace(updated, false);
        this.toastr.success(this.translate.instant(successKey));
        this.changed.emit();
      },
      error: err => {
        onError?.();
        this.onActionError(err);
      },
    });
  }

  private onActionError(err: unknown): void {
    this.busyId = null;
    const parsed = parseControlCenterError(err, this.translate);
    this.toastr.error(parsed.message);
    if (parsed.errorCode === 'APP_THEME_NOT_FOUND' || parsed.status === 404) this.load();
  }

  /** Swaps in the stored theme; a create appends and re-sorts by start day like the API does. */
  private replace(theme: SeasonalTheme, mayBeNew: boolean): void {
    const exists = this.themes.some(t => t.id === theme.id);
    if (exists) this.themes = this.themes.map(t => (t.id === theme.id ? theme : t));
    else if (mayBeNew) this.themes = [...this.themes, theme];
    this.themes = [...this.themes].sort((a, b) => a.startDate.localeCompare(b.startDate));
  }
}
