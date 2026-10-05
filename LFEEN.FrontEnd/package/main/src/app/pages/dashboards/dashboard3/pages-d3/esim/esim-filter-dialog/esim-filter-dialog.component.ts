import { Component, EventEmitter, HostListener, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { FormsModule } from '@angular/forms';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { EMPTY_ESIM_FILTERS, EsimFilters, EsimStatus } from '../interfaces/esim.model';

@Component({
  selector: 'app-esim-filter-dialog',
  standalone: true,
  imports: [CommonModule, A11yModule, FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './esim-filter-dialog.component.html',
  styleUrl: './esim-filter-dialog.component.scss'
})
export class EsimFilterDialogComponent implements OnChanges {
  private translate = inject(TranslateService);

  @Input() open = false;
  /** The filters currently applied to the list — copied into the draft each time the dialog opens. */
  @Input() filters: EsimFilters = EMPTY_ESIM_FILTERS;
  @Input() coverageOptions: string[] = [];
  @Input() networkOptions: string[] = [];
  /** How many rows a given selection would show, so the apply button can preview it. */
  @Input() countFor: (filters: EsimFilters) => number = () => 0;
  @Output() applied = new EventEmitter<EsimFilters>();
  @Output() closed = new EventEmitter<void>();

  draft: EsimFilters = { ...EMPTY_ESIM_FILTERS };

  readonly statusOptions: { value: EsimStatus | 'all'; labelKey: string }[] = [
    { value: 'all', labelKey: 'd3.esim.tabs.all' },
    { value: 'Active', labelKey: 'd3.esim.status.active' },
    { value: 'Pending', labelKey: 'd3.esim.status.pending' },
    { value: 'Expired', labelKey: 'd3.esim.status.expired' },
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open) {
      this.draft = { ...this.filters };
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
    return formatLocalizedNumber(this.countFor(this.draft), this.translate.currentLang || 'ar');
  }

  clear(): void {
    this.draft = { ...EMPTY_ESIM_FILTERS };
  }

  apply(): void {
    this.applied.emit({ ...this.draft });
  }
}
