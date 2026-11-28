import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnChanges, OnDestroy,
  Output, QueryList, ViewChild, ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ComplaintTab } from '../../interfaces/complaint.model';

/**
 * Segmented tab control: a white thumb slides under the active tab. Each tab can show its
 * total once that tab has loaded (counts are null until then, so nothing is guessed).
 */
@Component({
  selector: 'app-complaint-tabs-bar',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './complaint-tabs-bar.component.html',
  styleUrl: './complaint-tabs-bar.component.scss'
})
export class ComplaintTabsBarComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() activeTab: ComplaintTab = 'customers';
  @Input() counts: Partial<Record<ComplaintTab, number | null>> = {};
  @Output() tabChange = new EventEmitter<ComplaintTab>();

  @ViewChild('track') track?: ElementRef<HTMLElement>;
  @ViewChildren('tabBtn') tabButtons?: QueryList<ElementRef<HTMLButtonElement>>;

  readonly tabs: { key: ComplaintTab; labelKey: string }[] = [
    { key: 'hosts',     labelKey: 'd3.complaints.tabs.hosts'     },
    { key: 'customers', labelKey: 'd3.complaints.tabs.customers' },
    { key: 'resolved',  labelKey: 'd3.complaints.tabs.resolved'  },
    { key: 'ratings',   labelKey: 'd3.complaints.tabs.ratings'   },
  ];

  thumb = { left: 0, width: 0, ready: false };

  private resizeObserver?: ResizeObserver;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    // Tab widths change when translations or the font arrive, so follow their size.
    if (typeof ResizeObserver !== 'undefined' && this.track) {
      this.resizeObserver = new ResizeObserver(() => this.zone.run(() => this.placeThumb()));
      this.resizeObserver.observe(this.track.nativeElement);
      this.tabButtons?.forEach(b => this.resizeObserver!.observe(b.nativeElement));
    }
    queueMicrotask(() => this.placeThumb());
  }

  ngOnChanges(): void {
    queueMicrotask(() => this.placeThumb());
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  countFor(key: ComplaintTab): number | null {
    const value = this.counts[key];
    return typeof value === 'number' ? value : null;
  }

  private placeThumb(): void {
    const index = this.tabs.findIndex(t => t.key === this.activeTab);
    const button = this.tabButtons?.get(index)?.nativeElement;
    if (!button) return;
    this.thumb = { left: button.offsetLeft, width: button.offsetWidth, ready: true };
  }
}
