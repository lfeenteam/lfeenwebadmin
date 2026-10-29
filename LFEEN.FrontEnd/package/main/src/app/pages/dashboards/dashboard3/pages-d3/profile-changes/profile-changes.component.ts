import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { AccountProfileChangesService } from '../../services/account-profile-changes.service';
import { AccountProfileChangeListItem, ProfileSectionRoute } from '../../interfaces/account-profile-change.model';

const PAGE_SIZE = 20;

type SectionFilter = 'all' | ProfileSectionRoute;

// Queue of account settings changes waiting for a decision (branding / commercial
// register), oldest first. Shown as a tab inside account management; a row opens
// that account's review screen.
@Component({
  selector: 'app-profile-changes',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule],
  templateUrl: './profile-changes.component.html',
  styleUrl: './profile-changes.component.scss'
})
export class ProfileChangesComponent implements OnInit {
  private service = inject(AccountProfileChangesService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private destroyRef = inject(DestroyRef);

  // Inside another page: drop the page padding.
  @Input() embedded = false;
  // Total pending across both sections, emitted whenever the unfiltered list loads.
  @Output() countChange = new EventEmitter<number>();

  readonly filters: SectionFilter[] = ['all', 'branding', 'commercial-register'];
  activeFilter: SectionFilter = 'all';

  items: AccountProfileChangeListItem[] = [];
  totalCount: number | null = null;
  pageNumber = 1;
  hasNextPage = false;
  isLoading = false;
  isError = false;

  get dir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  ngOnInit(): void {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load());

    this.load();
  }

  setFilter(filter: SectionFilter): void {
    if (filter === this.activeFilter) return;
    this.activeFilter = filter;
    this.load();
  }

  load(append = false): void {
    const filter = this.activeFilter;
    this.pageNumber = append ? this.pageNumber + 1 : 1;
    this.isLoading = true;
    this.isError = false;
    this.service.list({
      section: filter === 'all' ? undefined : filter,
      pageNumber: this.pageNumber,
      pageSize: PAGE_SIZE
    }).subscribe({
      next: (res) => {
        if (filter !== this.activeFilter) return;
        const items = res?.items ?? [];
        this.items = append ? [...this.items, ...items] : items;
        this.totalCount = res?.totalCount ?? this.items.length;
        if (filter === 'all') this.countChange.emit(this.totalCount);
        this.hasNextPage = !!res?.hasNextPage;
        this.isLoading = false;
      },
      error: () => {
        if (filter !== this.activeFilter) return;
        this.isLoading = false;
        this.isError = true;
        this.toastr.error(this.translate.instant('d3.toast.errorOp'));
      }
    });
  }

  // The backend sends the enum name; unknown values are shown as-is.
  businessTypeLabel(type: string): string {
    const key = `d3.profileChanges.businessTypes.${type}`;
    const label = this.translate.instant(key);
    return label === key ? type : label;
  }

  open(item: AccountProfileChangeListItem): void {
    const lang = this.translate.currentLang || 'ar';
    // ?tab= is carried into the review screen's breadcrumb, back to this tab.
    this.router.navigate([lang, 'd3', 'account-management', 'profile-changes', item.accountId], {
      queryParams: { tab: 'profile-changes' }
    });
  }
}
