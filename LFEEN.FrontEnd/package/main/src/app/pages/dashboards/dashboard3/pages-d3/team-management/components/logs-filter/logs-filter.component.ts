import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MaterialModule } from 'src/app/material.module';
import { AdminAuditActionGroup, AdminAuditStatus, AuditDatePreset, AuditFilterSelection } from '../../../../interfaces/operation-audit.model';

export interface LogsFilterOption {
  value: string;
  label: string;
}

// Keys the action search box handles itself; everything else (arrows, Enter, Escape,
// Tab) still reaches mat-select so the list stays keyboard-navigable while typing.
const SELECT_NAV_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab']);

/** Lowercases and folds Arabic letter variants so "اعتماد" also matches "إعتماد". */
function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

@Component({
  selector: 'app-logs-filter',
  standalone: true,
  imports: [CommonModule, MaterialModule, TablerIconsModule, TranslateModule],
  templateUrl: './logs-filter.component.html',
  styleUrl: './logs-filter.component.scss'
})
export class LogsFilterComponent implements OnChanges {
  /**
   * Filters already applied when this bar is created (it is re-created on every tab
   * switch). Read once: later updates lag the search debounce and would overwrite typing.
   */
  @Input() initialSelection: AuditFilterSelection | null = null;
  @Input() actionGroups: readonly AdminAuditActionGroup[] = [];
  @Input() depts: LogsFilterOption[] = [];
  @Input() statuses: readonly AdminAuditStatus[] = [];
  @Input() datePresets: readonly AuditDatePreset[] = ['today', 'week', 'month'];

  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() filterActionChange = new EventEmitter<string>();
  @Output() filterDeptChange = new EventEmitter<string>();
  @Output() filterStatusChange = new EventEmitter<string>();
  @Output() filterDateChange = new EventEmitter<AuditDatePreset | ''>();
  @Output() clearFilters = new EventEmitter<void>();

  @ViewChild('actionSearchInput') private actionSearchInput?: ElementRef<HTMLInputElement>;

  searchQuery = '';
  selectedAction = '';
  selectedDept = '';
  selectedStatus = '';
  selectedDate: AuditDatePreset | '' = '';

  actionSearch = '';
  visibleActionGroups: readonly AdminAuditActionGroup[] = [];

  constructor(private translate: TranslateService) {}

  ngOnChanges(changes: SimpleChanges): void {
    const initial = changes['initialSelection'];
    if (initial?.firstChange && initial.currentValue) {
      const s: AuditFilterSelection = initial.currentValue;
      this.searchQuery = s.search;
      this.selectedAction = s.actionCode;
      this.selectedDept = s.departmentId;
      this.selectedStatus = s.status;
      this.selectedDate = s.datePreset;
    }
    if (changes['actionGroups']) this.filterActionGroups();
  }

  get hasActiveFilters(): boolean {
    return !!(this.searchQuery.trim() || this.selectedAction || this.selectedDept || this.selectedStatus || this.selectedDate);
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.searchQueryChange.emit(value);
  }

  onActionChange(code: string): void {
    this.selectedAction = code;
    this.filterActionChange.emit(code);
  }

  onDeptChange(value: string): void {
    this.selectedDept = value;
    this.filterDeptChange.emit(value);
  }

  onStatusChange(value: string): void {
    this.selectedStatus = value;
    this.filterStatusChange.emit(value);
  }

  onDateChange(value: AuditDatePreset | ''): void {
    this.selectedDate = value;
    this.filterDateChange.emit(value);
  }

  onClearFilters(): void {
    this.searchQuery = '';
    this.selectedAction = '';
    this.selectedDept = '';
    this.selectedStatus = '';
    this.selectedDate = '';
    // Supersedes a search still waiting on the debounce, so it can't land after the clear.
    this.searchQueryChange.emit('');
    this.clearFilters.emit();
  }

  onActionSearch(value: string): void {
    this.actionSearch = value;
    this.filterActionGroups();
  }

  onActionSearchKeydown(event: KeyboardEvent): void {
    // mat-select treats Space/letters as typeahead/selection; keep them in the input.
    if (!SELECT_NAV_KEYS.has(event.key)) event.stopPropagation();
  }

  onActionPanelToggle(open: boolean): void {
    if (open) {
      setTimeout(() => this.actionSearchInput?.nativeElement.focus());
    } else if (this.actionSearch) {
      this.onActionSearch('');
    }
  }

  private filterActionGroups(): void {
    const query = normalizeSearch(this.actionSearch);
    if (!query) {
      this.visibleActionGroups = this.actionGroups;
      return;
    }

    const matches = (text: string) => normalizeSearch(text).includes(query);
    this.visibleActionGroups = this.actionGroups
      .map(group => {
        // A matching group name shows the whole group.
        if (matches(this.translate.instant(`d3.teamManagement.opsLog.actionGroups.${group.key}`))) return group;
        return {
          ...group,
          // The selected code always stays rendered, otherwise mat-select drops it from the trigger.
          codes: group.codes.filter(
            code =>
              code === this.selectedAction ||
              matches(code) ||
              matches(this.translate.instant(`d3.teamManagement.opsLog.actions.${code}`))
          )
        };
      })
      .filter(group => group.codes.length > 0);
  }

  /** True when the search matched nothing (the always-kept selected option doesn't count). */
  get noActionMatches(): boolean {
    return !!this.actionSearch.trim() && this.visibleActionGroups.every(g => g.codes.every(c => c === this.selectedAction));
  }
}
