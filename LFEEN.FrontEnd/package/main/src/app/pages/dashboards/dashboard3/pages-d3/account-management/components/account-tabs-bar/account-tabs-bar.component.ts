import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from 'src/app/material.module';
import { TranslateModule } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { PAGE_FLAGS } from 'src/app/config/page-flags';

export type AccountTab = 'all' | 'active' | 'rejected' | 'under_review';
// profile_changes isn't an account status: it lists settings change requests from
// their own endpoint, so it stays out of AccountTab (AccountService's filter).
export type AccountsPageTab = AccountTab | 'profile_changes';

@Component({
  selector: 'app-account-tabs-bar',
  standalone: true,
  imports: [CommonModule, MaterialModule, TranslateModule, TablerIconsModule],
  templateUrl: './account-tabs-bar.component.html',
  styleUrl: './account-tabs-bar.component.scss'
})
export class AccountTabsBarComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() activeTab: AccountsPageTab = 'all';
  // Pending profile changes; shown on that tab when known and non-zero.
  @Input() profileChangesCount: number | null = null;
  @Output() tabChange = new EventEmitter<AccountsPageTab>();

  readonly tabs: { key: AccountsPageTab; label: string; hasDot?: boolean }[] = [
    { key: 'all',          label: 'd3.accountManagement.tabs.all' },
    { key: 'active',       label: 'd3.accountManagement.tabs.active' },
    { key: 'rejected',     label: 'd3.accountManagement.tabs.rejected' },
    { key: 'under_review', label: 'd3.accountManagement.tabs.underReview', hasDot: true },
    ...(PAGE_FLAGS['profile-changes']
      ? [{ key: 'profile_changes' as const, label: 'd3.accountManagement.tabs.profileChanges' }]
      : []),
  ];

  /** On narrow screens the strip scrolls sideways: whether tabs are hidden past each edge. */
  canScrollStart = false;
  canScrollEnd = false;

  @ViewChild('tabsRow') private tabsRow?: ElementRef<HTMLElement>;
  @ViewChildren('tabBtn', { read: ElementRef }) private tabBtns?: QueryList<ElementRef<HTMLElement>>;
  private resizeObserver?: ResizeObserver;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (typeof ResizeObserver !== 'undefined') {
      // Tab widths change after the fact (translations load, the pending count arrives),
      // so keep the open tab in view and the edge hints right whenever a tab resizes.
      const observer = new ResizeObserver(() => this.refresh(false));
      if (this.tabsRow) {
        observer.observe(this.tabsRow.nativeElement);
      }
      this.tabBtns?.forEach(btn => observer.observe(btn.nativeElement));
      this.resizeObserver = observer;
    }
    requestAnimationFrame(() => this.refresh(false));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.viewReady && changes['activeTab']) {
      requestAnimationFrame(() => this.refresh(true));
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.refresh(false);
  }

  updateScrollState(): void {
    const el = this.tabsRow?.nativeElement;
    if (!el) {
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    // RTL reports a negative scrollLeft, so compare magnitudes.
    const scrolled = Math.abs(el.scrollLeft);
    const start = maxScroll > 1 && scrolled > 1;
    const end = maxScroll > 1 && scrolled < maxScroll - 1;
    if (start !== this.canScrollStart || end !== this.canScrollEnd) {
      this.canScrollStart = start;
      this.canScrollEnd = end;
      this.cdr.detectChanges();
    }
  }

  scrollTabs(direction: 1 | -1): void {
    const el = this.tabsRow?.nativeElement;
    if (!el) {
      return;
    }
    const isRtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: el.clientWidth * 0.75 * direction * (isRtl ? -1 : 1), behavior: 'smooth' });
  }

  private refresh(smooth: boolean): void {
    this.revealActiveTab(smooth);
    this.updateScrollState();
  }

  /** Scrolls only the tab strip (never the page) so the open tab is fully visible. */
  private revealActiveTab(smooth: boolean): void {
    const row = this.tabsRow?.nativeElement;
    const index = this.tabs.findIndex(t => t.key === this.activeTab);
    const btn = index >= 0 ? this.tabBtns?.get(index)?.nativeElement : undefined;
    if (!row || !btn || row.scrollWidth <= row.clientWidth) {
      return;
    }
    // Keep the open tab clear of the edge fade.
    const margin = 40;
    const rowRect = row.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    let delta = 0;
    if (btnRect.left < rowRect.left + margin) {
      delta = btnRect.left - rowRect.left - margin;
    } else if (btnRect.right > rowRect.right - margin) {
      delta = btnRect.right - rowRect.right + margin;
    }
    if (Math.abs(delta) > 1) {
      // scrollBy's left is physical in both LTR and RTL.
      row.scrollBy({ left: delta, behavior: smooth ? 'smooth' : 'auto' });
    }
  }
}
