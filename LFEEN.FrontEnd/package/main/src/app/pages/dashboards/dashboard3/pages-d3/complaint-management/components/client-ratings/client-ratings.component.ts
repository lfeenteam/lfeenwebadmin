import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Subscription } from 'rxjs';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { getVisiblePages, formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { MaterialModule } from 'src/app/material.module';
import { TabsFilterComponent, BuildFilterOption } from '../../../all-builds/tabs-filter/tabs-filter.component';
import { SingleDateCalendarComponent } from '../../../all-bookings/components/single-date-calendar/single-date-calendar.component';
import { LoginService } from '../../../../services/login/login.service';
import { ComplaintService } from '../../services/complaint.service';
import { AssignableEmployee, CLIENT_TICKET_DEPARTMENT_OPTIONS } from '../../interfaces/complaint.model';
import {
  CLIENT_RATINGS_PAGE_SIZE,
  ClientRatingByAgentItem,
  ClientRatingItem,
  ClientRatingSummary,
  RATING_STARS
} from '../../interfaces/ratings.model';

type RatingsView = 'list' | 'agents';

const CLOSED_BY_KEYS: Record<string, string> = {
  Client: 'd3.complaints.ratings.closedBy.client',
  Admin:  'd3.complaints.ratings.closedBy.admin',
  Bot:    'd3.complaints.ratings.closedBy.bot',
};

@Component({
  selector: 'app-client-ratings',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, MaterialModule, TabsFilterComponent, SingleDateCalendarComponent, DashboardEmptyComponent, DashboardLoadingComponent],
  templateUrl: './client-ratings.component.html',
  styleUrl: './client-ratings.component.scss'
})
export class ClientRatingsComponent implements OnInit {
  /** Session whose chat is currently open next to the list — highlights its row. */
  @Input() selectedSessionId: string | null = null;
  @Output() openSession = new EventEmitter<string>();

  private destroyRef = inject(DestroyRef);
  private service = inject(ComplaintService);
  private login = inject(LoginService);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);

  // Without it the backend scopes the list to the caller's own sessions and rejects by-agent
  // with a 403, so the agent filter and the per-agent view are simply not offered.
  readonly canViewAll = computed(() => this.login.permissions().some(p => p.toLowerCase() === 'clienttickets.viewallratings'));

  readonly starSlots = [1, 2, 3, 4, 5];
  readonly distributionStars = RATING_STARS;

  view: RatingsView = 'list';

  department: string | null = null;
  agentUserId: string | null = null;
  minRating: number | null = null;
  maxRating: number | null = null;
  fromDate = '';
  toDate = '';

  // Kept as fields, not getters: app-tabs-filter needs reference-stable inputs.
  filterOptions: BuildFilterOption[] = [];
  activeFilters: Record<string, string> = {};

  rows: ClientRatingItem[] = [];
  summary: ClientRatingSummary | null = null;
  currentPage = 1;
  totalCount = 0;
  totalPages = 1;
  loading = false;
  loadError = false;
  forbidden = false;

  agentRows: ClientRatingByAgentItem[] = [];
  agentsLoading = false;
  agentsError = false;

  private employees: AssignableEmployee[] = [];
  private listSub?: Subscription;
  private agentsSub?: Subscription;

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get visiblePages(): (number | '...')[] {
    return getVisiblePages(this.currentPage, this.totalPages);
  }

  get hasActiveFilters(): boolean {
    return this.department !== null || this.agentUserId !== null || this.minRating !== null ||
      this.maxRating !== null || !!this.fromDate || !!this.toDate;
  }

  ngOnInit(): void {
    this.rebuildFilters();
    this.loadList();

    if (this.canViewAll()) {
      this.service.getAssignableEmployees(undefined, 1, 50)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: page => {
            this.employees = Array.isArray(page?.data) ? page.data : [];
            this.rebuildFilters();
          },
          error: () => { /* agent filter simply stays empty if this call fails */ },
        });
    }
  }

  setView(view: RatingsView): void {
    if (view === this.view) return;
    this.view = view;
    this.rebuildFilters();
    this.reload();
  }

  onFiltersChange(filters: Record<string, string>): void {
    const norm = (v: string | undefined) => (v && v !== 'all' ? v : null);
    let min = Number(norm(filters['minRating'])) || null;
    let max = Number(norm(filters['maxRating'])) || null;
    // Upstream rejects minRating > maxRating — keep the bound that was just picked and drop the other.
    if (min !== null && max !== null && min > max) {
      if (min !== this.minRating) max = null; else min = null;
    }

    this.department = norm(filters['department']);
    if (this.view === 'list') {
      this.agentUserId = norm(filters['agent']);
      this.minRating = min;
      this.maxRating = max;
    }
    this.syncActiveFilters();
    this.currentPage = 1;
    this.reload();
  }

  onDateSelect(changed: 'from' | 'to', date: string): void {
    if (changed === 'from') this.fromDate = date; else this.toDate = date;
    // Keep the range coherent: the bound that now contradicts the picked one is dropped.
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      if (changed === 'from') this.toDate = ''; else this.fromDate = '';
    }
    this.currentPage = 1;
    this.reload();
  }

  resetFilters(): void {
    this.department = null;
    this.agentUserId = null;
    this.minRating = null;
    this.maxRating = null;
    this.fromDate = '';
    this.toDate = '';
    this.syncActiveFilters();
    this.currentPage = 1;
    this.reload();
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.loadList();
  }

  reload(): void {
    if (this.view === 'agents') this.loadAgents(); else this.loadList();
  }

  private loadList(): void {
    this.listSub?.unsubscribe();
    this.loading = true;
    this.loadError = false;
    this.forbidden = false;
    this.listSub = this.service.getClientRatings({
      agentUserId: this.agentUserId ?? undefined,
      department: this.department ?? undefined,
      minRating: this.minRating ?? undefined,
      maxRating: this.maxRating ?? undefined,
      from: this.fromIso(),
      to: this.toIso(),
      page: this.currentPage,
      pageSize: CLIENT_RATINGS_PAGE_SIZE,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.rows = res.data ?? [];
          this.summary = res.summary ?? null;
          this.totalCount = res.totalCount ?? 0;
          this.totalPages = Math.max(1, res.totalPages ?? 1);
          this.loading = false;
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          // Upstream validation errors come back as a 400 with a readable message.
          if (err?.status === 400 && err?.error?.message) {
            this.toastr.error(err.error.message);
            return;
          }
          this.rows = [];
          this.summary = null;
          this.totalCount = 0;
          this.totalPages = 1;
          this.forbidden = err?.status === 403;
          this.loadError = !this.forbidden;
        },
      });
  }

  private loadAgents(): void {
    this.agentsSub?.unsubscribe();
    this.agentsLoading = true;
    this.agentsError = false;
    this.agentsSub = this.service.getClientRatingsByAgent({
      department: this.department ?? undefined,
      from: this.fromIso(),
      to: this.toIso(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.agentRows = [...(Array.isArray(res) ? res : [])]
            .sort((a, b) => b.averageRating - a.averageRating || b.totalRated - a.totalRated);
          this.agentsLoading = false;
        },
        error: () => {
          this.agentRows = [];
          this.agentsLoading = false;
          this.agentsError = true;
        },
      });
  }

  // The picked day is in the viewer's time zone; send its full local span as UTC instants
  // so the chosen "to" day is included (both bounds are inclusive on ratedAtUtc).
  private fromIso(): string | undefined {
    return this.fromDate ? new Date(`${this.fromDate}T00:00:00`).toISOString() : undefined;
  }

  private toIso(): string | undefined {
    return this.toDate ? new Date(`${this.toDate}T23:59:59.999`).toISOString() : undefined;
  }

  private rebuildFilters(): void {
    const allItem = (labelKey: string) => ({ value: 'all', labelKey });
    const options: BuildFilterOption[] = [
      {
        id: 'department',
        labelKey: 'd3.complaints.hostFilters.allDepartments',
        items: [allItem('d3.complaints.hostFilters.allDepartments'), ...CLIENT_TICKET_DEPARTMENT_OPTIONS],
      },
    ];

    // by-agent accepts department/from/to only.
    if (this.view === 'list') {
      if (this.canViewAll()) {
        options.push({
          id: 'agent',
          labelKey: 'd3.complaints.hostFilters.allEmployees',
          items: [
            allItem('d3.complaints.hostFilters.allEmployees'),
            ...this.employees.map(e => ({ value: e.userId, labelKey: e.fullName })),
          ],
        });
      }
      options.push(
        {
          id: 'minRating',
          labelKey: 'd3.complaints.ratings.filters.minRating',
          items: [
            allItem('d3.complaints.ratings.filters.minRating'),
            ...this.starSlots.map(n => ({ value: String(n), labelKey: `d3.complaints.ratings.filters.min.${n}` })),
          ],
        },
        {
          id: 'maxRating',
          labelKey: 'd3.complaints.ratings.filters.maxRating',
          items: [
            allItem('d3.complaints.ratings.filters.maxRating'),
            ...this.starSlots.map(n => ({ value: String(n), labelKey: `d3.complaints.ratings.filters.max.${n}` })),
          ],
        },
      );
    }

    this.filterOptions = options;
    this.syncActiveFilters();
  }

  private syncActiveFilters(): void {
    this.activeFilters = {
      department: this.department ?? 'all',
      agent: this.agentUserId ?? 'all',
      minRating: this.minRating !== null ? String(this.minRating) : 'all',
      maxRating: this.maxRating !== null ? String(this.maxRating) : 'all',
    };
  }

  departmentLabel(department: string | null): string {
    if (!department) return '—';
    const option = CLIENT_TICKET_DEPARTMENT_OPTIONS.find(o => o.value === department);
    return option ? this.translate.instant(option.labelKey) : department;
  }

  closedByLabel(closedBy: string | null): string {
    if (!closedBy) return '—';
    const key = CLOSED_BY_KEYS[closedBy];
    return key ? this.translate.instant(key) : closedBy;
  }

  ratingClass(rating: number): string {
    return rating >= 4 ? 'is-good' : rating >= 3 ? 'is-mid' : 'is-low';
  }

  roundedStars(average: number | null | undefined): number {
    return Math.round(average ?? 0);
  }

  distributionCount(distribution: Record<string, number> | null | undefined, stars: number): number {
    return distribution?.[String(stars)] ?? 0;
  }

  distributionPercent(distribution: Record<string, number> | null | undefined, stars: number, total: number): number {
    return total > 0 ? (this.distributionCount(distribution, stars) / total) * 100 : 0;
  }

  /** 'YYYY-MM-DD' (a local calendar day) → localized short date. */
  fmtDay(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-EG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  fmtDate(iso: string | null): string {
    return formatApiDateLocal(iso, this.translate.currentLang, true) ?? '—';
  }

  fmt(n: number): string {
    return formatLocalizedNumber(n ?? 0, this.translate.currentLang);
  }

  fmtAverage(n: number | null | undefined): string {
    return (n ?? 0).toLocaleString(this.translate.currentLang === 'en' ? 'en-US' : 'ar-SA', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    });
  }
}
