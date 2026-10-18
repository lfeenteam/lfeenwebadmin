import { Component, DestroyRef, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable, Subject, of } from 'rxjs';
import { catchError, debounceTime, switchMap } from 'rxjs/operators';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { EMPTY_ESIM_FILTERS, EsimDestinationOption, EsimFilters, EsimStatusBucket } from '../interfaces/esim.model';

const COUNT_DEBOUNCE_MS = 250;

@Component({
  selector: 'app-esim-filter-dialog',
  standalone: true,
  imports: [CommonModule, A11yModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './esim-filter-dialog.component.html',
  styleUrl: './esim-filter-dialog.component.scss'
})
export class EsimFilterDialogComponent implements OnChanges {
  private translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  @Input() open = false;
  /** The filters currently applied to the list — copied into the draft each time the dialog opens. */
  @Input() filters: EsimFilters = EMPTY_ESIM_FILTERS;
  @Input() coverageOptions: EsimDestinationOption[] = [];
  @Input() networkOptions: string[] = [];
  /** How many rows a given selection would show (asked of the server), so the apply button can preview it. */
  @Input() countFor: (filters: EsimFilters) => Observable<number> = () => of(0);
  @Output() applied = new EventEmitter<EsimFilters>();
  @Output() closed = new EventEmitter<void>();

  draft: EsimFilters = { ...EMPTY_ESIM_FILTERS };
  /** null while the preview count is loading (or failed). */
  private previewCount: number | null = null;
  private draftChange$ = new Subject<EsimFilters>();

  readonly statusOptions: { value: EsimStatusBucket | 'all'; labelKey: string }[] = [
    { value: 'all', labelKey: 'd3.esim.tabs.all' },
    { value: 'Active', labelKey: 'd3.esim.status.active' },
    { value: 'PendingActivation', labelKey: 'd3.esim.status.pending' },
    { value: 'Suspended', labelKey: 'd3.esim.status.suspended' },
    { value: 'Expired', labelKey: 'd3.esim.status.expired' },
  ];

  constructor() {
    this.draftChange$
      .pipe(
        debounceTime(COUNT_DEBOUNCE_MS),
        switchMap(f => this.countFor(f).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(count => { this.previewCount = count; });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.draft = { ...this.filters };
      this.onDraftChange();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.closed.emit();
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get resultCount(): string {
    return this.previewCount === null
      ? '…'
      : formatLocalizedNumber(this.previewCount, this.translate.currentLang || 'ar');
  }

  setStatus(status: EsimStatusBucket | 'all'): void {
    this.draft.status = status;
    this.onDraftChange();
  }

  onDraftChange(): void {
    this.previewCount = null;
    this.draftChange$.next({ ...this.draft });
  }

  clear(): void {
    this.draft = { ...EMPTY_ESIM_FILTERS };
    this.onDraftChange();
  }

  apply(): void {
    this.applied.emit({ ...this.draft });
  }
}
