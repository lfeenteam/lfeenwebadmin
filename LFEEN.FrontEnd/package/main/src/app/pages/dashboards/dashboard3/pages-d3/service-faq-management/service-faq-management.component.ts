import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import { CoreService } from 'src/app/services/core.service';
import { AR_LOCALE } from 'src/app/utils/locale-format.util';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DeleteConfirmDialogComponent } from '../team-management/components/delete-confirm-dialog/delete-confirm-dialog.component';
import { ServiceFaqDialogComponent, ServiceFaqDialogData } from './components/service-faq-dialog/service-faq-dialog.component';
import { SERVICE_FAQ_CATEGORY_OPTIONS, ServiceFaqCategory, ServiceFaqDto } from './interfaces/service-faq.model';
import { parseServiceFaqError } from './interfaces/service-faq-error.util';
import { ServiceFaqService } from './services/service-faq.service';

/** Service (worker) app FAQ — what the admin edits here shows in the worker app right away. */
@Component({
  selector: 'app-service-faq-management',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TablerIconsModule, MaterialModule, DashboardLoadingComponent, DashboardEmptyComponent],
  templateUrl: './service-faq-management.component.html',
  styleUrls: [
    '../faq-management/faq-management.component.scss',
    './service-faq-management.component.scss',
  ],
})
export class ServiceFaqManagementComponent implements OnInit {
  private api = inject(ServiceFaqService);
  private dialog = inject(MatDialog);
  private toastr = inject(ToastrService);
  private translate = inject(TranslateService);
  private coreService = inject(CoreService);
  private destroyRef = inject(DestroyRef);

  readonly categoryOptions = SERVICE_FAQ_CATEGORY_OPTIONS;
  readonly dirSignal = computed(() => this.coreService.getOptionsSignal()().dir);
  private readonly isEn = computed(() => this.coreService.getOptionsSignal()().language === 'en');

  // Filters — all sent to the server, the list is never filtered in the browser.
  readonly category = signal<ServiceFaqCategory | null>(null);
  readonly includeInactive = signal(true);
  /** Bound to the search box. */
  searchTerm = '';
  /** The debounced term actually sent to the server. */
  private readonly appliedSearch = signal('');

  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly faqs = signal<ServiceFaqDto[]>([]);
  /** Rows with an activate/deactivate or delete request in flight. */
  readonly busyIds = signal<ReadonlySet<string>>(new Set());

  readonly totalCount = computed(() => this.faqs().length);
  readonly activeCount = computed(() => this.faqs().filter(f => f.isActive).length);
  readonly inactiveCount = computed(() => this.faqs().filter(f => !f.isActive).length);
  readonly hasFilters = computed(() => this.category() !== null || !!this.appliedSearch());

  private readonly load$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  ngOnInit(): void {
    this.load$.pipe(
      tap(() => { this.loading.set(true); this.loadError.set(false); }),
      switchMap(() => this.api.getAll({
        includeInactive: this.includeInactive(),
        category: this.category() ?? undefined,
        search: this.appliedSearch() || undefined,
      }).pipe(
        map(list => ({ ok: true as const, list })),
        catchError(() => of({ ok: false as const, list: [] as ServiceFaqDto[] })),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(res => {
      this.loading.set(false);
      if (!res.ok) {
        this.loadError.set(true);
        this.faqs.set([]);
        return;
      }
      this.faqs.set(this.sorted(res.list));
    });

    this.search$.pipe(
      debounceTime(350),
      map(term => term.trim()),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(term => {
      this.appliedSearch.set(term);
      this.reload();
    });

    // categoryName comes localized from Accept-Language — refetch on a language switch.
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reload());

    this.reload();
  }

  reload(): void {
    this.load$.next();
  }

  onSearchInput(term: string): void {
    this.search$.next(term);
  }

  setCategory(value: ServiceFaqCategory | null): void {
    if (this.category() === value) return;
    this.category.set(value);
    this.reload();
  }

  onIncludeInactiveChange(value: boolean): void {
    this.includeInactive.set(value);
    this.reload();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.appliedSearch.set('');
    // Keeps distinctUntilChanged in step, so typing the old term again still searches.
    this.search$.next('');
    this.category.set(null);
    this.reload();
  }

  selectedCategoryLabel(): string {
    const opt = this.categoryOptions.find(c => c.value === this.category());
    return this.translate.instant(opt ? opt.labelKey : 'd3.serviceFaq.filter.allCategories');
  }

  question(f: ServiceFaqDto): string {
    return (this.isEn() ? f.questionEn || f.questionAr : f.questionAr || f.questionEn) ?? '';
  }

  /** The other language under the main one, so the admin sees both at a glance. */
  secondaryQuestion(f: ServiceFaqDto): string {
    return (this.isEn() ? f.questionAr : f.questionEn) ?? '';
  }

  categoryLabel(f: ServiceFaqDto): string {
    if (f.categoryName) return f.categoryName;
    const opt = this.categoryOptions.find(c => c.value === f.category);
    return opt ? this.translate.instant(opt.labelKey) : f.category;
  }

  lastUpdated(f: ServiceFaqDto): string {
    const value = f.updatedAtUtc || f.createdAtUtc;
    const date = value ? new Date(value) : null;
    if (!date || isNaN(date.getTime())) return '—';
    return date.toLocaleDateString(this.isEn() ? 'en-US' : AR_LOCALE, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  isBusy(id: string): boolean {
    return this.busyIds().has(id);
  }

  openAddDialog(): void {
    const nextOrder = this.faqs().reduce((max, f) => Math.max(max, f.displayOrder), -1) + 1;
    this.openDialog({ nextOrder });
  }

  openEditDialog(faq: ServiceFaqDto): void {
    this.openDialog({ faq, nextOrder: faq.displayOrder });
  }

  private openDialog(data: ServiceFaqDialogData): void {
    const ref = this.dialog.open(ServiceFaqDialogComponent, { width: '720px', maxWidth: '95vw', data });
    ref.afterClosed().subscribe(result => {
      if (!result) return;
      if (result === 'notFound') {
        this.toastr.error(this.translate.instant('d3.serviceFaq.toast.notFound'));
        this.reload();
        return;
      }
      this.toastr.success(this.translate.instant(data.faq ? 'd3.serviceFaq.toast.updateSuccess' : 'd3.serviceFaq.toast.addSuccess'));
      // Reload so the row lands where the server's filters and order put it.
      this.reload();
    });
  }

  toggleActive(faq: ServiceFaqDto): void {
    if (this.isBusy(faq.id)) return;
    this.setBusy(faq.id, true);
    this.api.setActive(faq.id, !faq.isActive).subscribe({
      next: dto => {
        this.setBusy(faq.id, false);
        const updated = dto && dto.id ? dto : { ...faq, isActive: !faq.isActive };
        // Hidden-inactive view: a deactivated row leaves the list.
        if (!updated.isActive && !this.includeInactive()) {
          this.faqs.update(list => list.filter(f => f.id !== faq.id));
        } else {
          this.faqs.update(list => list.map(f => (f.id === faq.id ? updated : f)));
        }
        this.toastr.success(this.translate.instant('d3.serviceFaq.toast.statusUpdateSuccess'));
      },
      error: err => {
        this.setBusy(faq.id, false);
        this.showError(err);
      },
    });
  }

  /** Confirmation is an in-page dialog, never the browser's confirm(). */
  deleteFaq(faq: ServiceFaqDto): void {
    const ref = this.dialog.open(DeleteConfirmDialogComponent, {
      width: '440px',
      data: { title: 'd3.serviceFaq.delete.title', message: 'd3.serviceFaq.delete.message' },
      panelClass: 'custom-confirm-dialog',
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.setBusy(faq.id, true);
      this.api.delete(faq.id).subscribe({
        next: () => {
          this.setBusy(faq.id, false);
          this.faqs.update(list => list.filter(f => f.id !== faq.id));
          this.toastr.success(this.translate.instant('d3.serviceFaq.toast.deleteSuccess'));
        },
        error: err => {
          this.setBusy(faq.id, false);
          this.showError(err);
        },
      });
    });
  }

  private showError(err: unknown): void {
    const parsed = parseServiceFaqError(err, this.translate);
    const fieldText = Object.values(parsed.fieldErrors).filter(Boolean).join(' - ');
    this.toastr.error(parsed.message || fieldText || this.translate.instant('d3.toast.errorOp'));
    // The row no longer exists on the server — refresh so it disappears.
    if (parsed.notFound) this.reload();
  }

  private setBusy(id: string, busy: boolean): void {
    this.busyIds.update(set => {
      const next = new Set(set);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  private sorted(list: ServiceFaqDto[]): ServiceFaqDto[] {
    return [...list].sort((a, b) => a.displayOrder - b.displayOrder);
  }
}
