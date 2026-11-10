import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { AdditionalConditionsReviewComponent } from 'src/app/components/dashboard3/additional-conditions-review/additional-conditions-review.component';
import { AdditionalConditionsService } from '../../services/additional-conditions.service';
import { AdditionalConditionListResult, AdditionalConditionScope, AdminAdditionalCondition } from '../../interfaces/additional-condition.model';

const PAGE_SIZE = 20;

type ConditionsView = 'pending' | 'all';

// "بانتظار المراجعة" queue for additional conditions (doc section 10, item 10):
// one tab per level, each listing status=Pending (new conditions + pending edits,
// oldest edit first). Decisions are taken inline; a decided row leaves the queue.
// The "all" view lists every condition of the level whatever its status.
@Component({
  selector: 'app-additional-conditions-pending',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TablerIconsModule, AdditionalConditionsReviewComponent],
  templateUrl: './additional-conditions-pending.component.html',
  styleUrl: './additional-conditions-pending.component.scss'
})
export class AdditionalConditionsPendingComponent implements OnInit {
  private service = inject(AdditionalConditionsService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private destroyRef = inject(DestroyRef);

  readonly views: ConditionsView[] = ['pending', 'all'];
  activeView: ConditionsView = 'pending';
  readonly tabs: AdditionalConditionScope[] = ['account', 'property', 'unit'];
  activeTab: AdditionalConditionScope = 'property';
  counts: Record<AdditionalConditionScope, number | null> = { account: null, property: null, unit: null };

  items: AdminAdditionalCondition[] = [];
  search = '';
  pageNumber = 1;
  hasNextPage = false;
  isLoading = false;
  isError = false;

  private search$ = new Subject<string>();

  get dir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());

    this.loadCounts();
    this.load();
  }

  setView(view: ConditionsView): void {
    if (view === this.activeView) return;
    this.activeView = view;
    this.counts = { account: null, property: null, unit: null };
    this.loadCounts();
    this.load();
  }

  setTab(tab: AdditionalConditionScope): void {
    if (tab === this.activeTab) return;
    this.activeTab = tab;
    this.load();
  }

  private get statusFilter(): 'Pending' | undefined {
    return this.activeView === 'pending' ? 'Pending' : undefined;
  }

  onSearch(value: string): void {
    this.search$.next(value.trim());
  }

  load(append = false): void {
    const scope = this.activeTab;
    const view = this.activeView;
    this.pageNumber = append ? this.pageNumber + 1 : 1;
    this.isLoading = true;
    this.isError = false;
    this.service.list(scope, {
      status: this.statusFilter,
      search: this.search.trim() || undefined,
      pageNumber: this.pageNumber,
      pageSize: PAGE_SIZE
    }).subscribe({
      next: (res) => {
        if (scope !== this.activeTab || view !== this.activeView) return;
        this.items = append ? [...this.items, ...res.items] : res.items;
        this.hasNextPage = res.hasNextPage;
        // Without a search filter the list total is the tab's real count for this view.
        if (!this.search.trim()) this.counts[scope] = this.countFrom(res);
        this.isLoading = false;
      },
      error: () => {
        if (scope !== this.activeTab || view !== this.activeView) return;
        this.isLoading = false;
        this.isError = true;
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
      }
    });
  }

  private loadCounts(): void {
    const view = this.activeView;
    this.tabs.filter(t => t !== this.activeTab).forEach(scope => {
      this.service.list(scope, { status: this.statusFilter, pageNumber: 1, pageSize: 1 }).subscribe({
        next: (res) => { if (view === this.activeView) this.counts[scope] = this.countFrom(res); },
        error: () => { if (view === this.activeView) this.counts[scope] = null; }
      });
    });
  }

  private countFrom(res: AdditionalConditionListResult): number {
    return this.activeView === 'pending' ? res.stats?.awaitingReview ?? res.totalCount : res.totalCount;
  }

  // In the "all" view a decided row just changes its badge in place (the shared
  // component already updated it); only the pending queue drops it.
  onDecided(condition: AdminAdditionalCondition): void {
    if (this.activeView === 'all') return;
    if (condition.decision === 'Pending' || condition.decision === 'PendingUpdate') return;
    this.items = this.items.filter(c => c.id !== condition.id);
    const count = this.counts[this.activeTab];
    if (count) this.counts[this.activeTab] = count - 1;
  }

  openTarget(c: AdminAdditionalCondition): void {
    const lang = this.translate.currentLang || 'ar';
    let segments: (string | number)[] | null = null;
    if (this.activeTab === 'account' && c.accountId) {
      segments = ['account-management', 'review', c.accountId];
    } else if (this.activeTab === 'property' && c.propertyId) {
      segments = ['build-review', c.propertyId];
    } else if (this.activeTab === 'unit' && c.unitId) {
      segments = c.propertyId ? ['unit-review', c.propertyId, c.unitId, 'terms'] : ['units'];
    }
    if (segments) {
      this.router.navigate([lang, 'd3', ...segments], this.activeTab === 'property' ? { queryParams: { section: 'terms' } } : {});
    }
  }
}
