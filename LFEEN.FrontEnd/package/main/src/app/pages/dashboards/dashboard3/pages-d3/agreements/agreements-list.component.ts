import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { Subscription } from 'rxjs';
import { DashboardEmptyComponent } from 'src/app/components/dashboard3/dashboard-empty/dashboard-empty.component';
import { DashboardLoadingComponent } from 'src/app/components/dashboard3/dashboard-loading/dashboard-loading.component';
import {
  AGREEMENT_TYPES,
  AgreementType,
  AgreementVersion,
  sortAgreementVersions,
} from './interfaces/agreement.model';
import { AgreementActionOutcome, AgreementActionsService } from './services/agreement-actions.service';
import { AgreementLabelsService } from './services/agreement-labels.service';
import { AgreementsService } from './services/agreements.service';
import { AgreementApiError, parseAgreementError } from './utils/agreement-errors.util';

const PAGE_SIZE = 10;

/** /d3/agreements: one tab per agreement type, its current version, and every version. */
@Component({
  selector: 'app-agreements-list',
  standalone: true,
  imports: [
    CommonModule,
    MatMenuModule,
    TranslateModule,
    TablerIconsModule,
    DashboardEmptyComponent,
    DashboardLoadingComponent,
  ],
  templateUrl: './agreements-list.component.html',
  styleUrl: './agreements.component.scss',
})
export class AgreementsListComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(AgreementsService);
  private translate = inject(TranslateService);
  readonly actions = inject(AgreementActionsService);
  readonly labels = inject(AgreementLabelsService);

  readonly types = AGREEMENT_TYPES;
  readonly type = signal<AgreementType>('Host');
  readonly versions = signal<AgreementVersion[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal<AgreementApiError | null>(null);
  readonly page = signal(1);
  /** Row with an action in flight (copy / end / delete). */
  readonly busyId = signal<number | null>(null);

  readonly canEdit = this.actions.canEdit;
  readonly canPublish = this.actions.canPublish;

  readonly current = computed(() => this.versions().find((v) => v.isCurrent) ?? null);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.versions().length / PAGE_SIZE)));
  readonly pageRows = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.versions().slice(start, start + PAGE_SIZE);
  });
  readonly rangeText = computed(() => {
    const total = this.versions().length;
    const from = total ? (this.page() - 1) * PAGE_SIZE + 1 : 0;
    const to = Math.min(this.page() * PAGE_SIZE, total);
    return this.translate.instant('d3.agreements.pagination.range', {
      from: this.labels.num(from),
      to: this.labels.num(to),
      total: this.labels.num(total),
    });
  });

  private loadSub?: Subscription;

  get dir(): 'rtl' | 'ltr' {
    return this.labels.dir;
  }

  ngOnInit(): void {
    // The tab lives in the URL (?type=ServiceLevel) so back/refresh keep it.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const raw = params.get('type');
      const type: AgreementType = raw === 'ServiceLevel' ? 'ServiceLevel' : 'Host';
      if (type !== this.type() || !this.versions().length) {
        this.type.set(type);
        this.page.set(1);
        this.load();
      }
    });
    // statusName and error messages come back in the request's language.
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  selectType(type: AgreementType): void {
    if (type === this.type()) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type: type === 'Host' ? null : type },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  load(): void {
    this.loadSub?.unsubscribe();
    const type = this.type();
    this.loading.set(true);
    this.loadError.set(null);
    this.loadSub = this.service
      .list(type)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.versions.set(sortAgreementVersions((list || []).filter((v) => v.type === type)));
          if (this.page() > this.totalPages()) this.page.set(this.totalPages());
          this.loading.set(false);
        },
        error: (err) => {
          this.versions.set([]);
          this.loadError.set(parseAgreementError(err));
          this.loading.set(false);
        },
      });
  }

  loadErrorDescKey(): string {
    return this.loadError()?.kind === 'forbidden'
      ? 'd3.agreements.errors.forbidden'
      : 'd3.agreements.errors.loadDesc';
  }

  changePage(p: number): void {
    if (p >= 1 && p <= this.totalPages()) this.page.set(p);
  }

  open(v: AgreementVersion): void {
    this.actions.openVersion(v.id);
  }

  newDraft(): void {
    this.actions.openNewDraft(this.type(), this.versions());
  }

  preview(v: AgreementVersion, lang: 'ar' | 'en'): void {
    this.actions.preview(v.id, lang);
  }

  copy(v: AgreementVersion): void {
    this.run(v, () => this.actions.copyAsDraft(v), false);
  }

  editExpiry(v: AgreementVersion): void {
    this.run(v, () => this.actions.openExpiry(v));
  }

  end(v: AgreementVersion): void {
    this.run(v, () => this.actions.confirmEnd(v));
  }

  remove(v: AgreementVersion): void {
    this.run(v, () => this.actions.confirmDelete(v));
  }

  /**
   * Runs a row action, then reloads the whole list: a write can change isCurrent/status
   * on other versions too (e.g. publish with endPreviousVersions).
   */
  private async run(v: AgreementVersion, action: () => Promise<AgreementActionOutcome>, reload = true): Promise<void> {
    if (this.busyId() !== null) return;
    this.busyId.set(v.id);
    try {
      const outcome = await action();
      if (outcome.kind !== 'cancelled' && (reload || outcome.kind !== 'done')) this.load();
    } finally {
      this.busyId.set(null);
    }
  }
}
