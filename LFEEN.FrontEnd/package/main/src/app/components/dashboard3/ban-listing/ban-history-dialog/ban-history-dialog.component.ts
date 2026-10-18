import { Component, OnInit, inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { formatApiDateLocal } from 'src/app/utils/date-format.util';
import { ListingBanService } from 'src/app/pages/dashboards/dashboard3/services/listing-ban.service';
import { BanAction, BanHistoryItem, ListingKind } from 'src/app/pages/dashboards/dashboard3/interfaces/listing-ban.model';

export interface BanHistoryDialogData {
  kind: ListingKind;
  id: string;
  name?: string;
}

const PAGE_SIZE = 20;

const ACTION_META: Record<BanAction, { key: string; icon: string; mod: string }> = {
  Ban:          { key: 'd3.listingBan.history.actions.ban',          icon: 'ban',       mod: 'ban'    },
  UpdateReason: { key: 'd3.listingBan.history.actions.updateReason', icon: 'edit',      mod: 'edit'   },
  Unban:        { key: 'd3.listingBan.history.actions.unban',        icon: 'lock-open', mod: 'unban'  },
};

/** Timeline of ban / reason-change / unban actions for one property or unit. */
@Component({
  selector: 'app-ban-history-dialog',
  standalone: true,
  imports: [TablerIconsModule, TranslateModule, MatProgressSpinnerModule],
  templateUrl: './ban-history-dialog.component.html',
  styleUrl: './ban-history-dialog.component.scss'
})
export class BanHistoryDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<BanHistoryDialogComponent>);
  readonly data = inject<BanHistoryDialogData>(MAT_DIALOG_DATA);
  private banService = inject(ListingBanService);
  private translate = inject(TranslateService);

  items: BanHistoryItem[] = [];
  page = 1;
  totalCount = 0;
  loading = false;
  loadError = false;

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  // The history response has no totalPages/hasNextPage, unlike the list endpoints.
  get hasMore(): boolean {
    return this.items.length < this.totalCount;
  }

  ngOnInit(): void {
    this.load(1);
  }

  load(page: number): void {
    this.loading = true;
    this.loadError = false;
    this.banService.getHistory(this.data.kind, this.data.id, page, PAGE_SIZE).subscribe({
      next: res => {
        // "Load more" appends; page 1 (first load / retry) replaces.
        this.items = page === 1 ? res.items : [...this.items, ...res.items];
        this.totalCount = res.totalCount;
        this.page = page;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  loadMore(): void {
    if (!this.loading && this.hasMore) this.load(this.page + 1);
  }

  meta(item: BanHistoryItem) {
    return ACTION_META[item.action] ?? ACTION_META.Ban;
  }

  date(item: BanHistoryItem): string {
    return formatApiDateLocal(item.createdAt, this.translate.currentLang, true) ?? '—';
  }

  close(): void {
    this.dialogRef.close();
  }
}
