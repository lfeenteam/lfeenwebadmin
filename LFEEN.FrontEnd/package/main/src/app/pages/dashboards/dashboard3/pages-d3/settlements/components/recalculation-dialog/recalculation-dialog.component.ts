import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { filter } from 'rxjs';
import { PayoutRecalculation, RecalculationAdjustment } from '../../interfaces/settlement.model';
import { resolveSettlementError } from '../../interfaces/settlement-error.util';
import { adjustmentKindKey, rawBlockerTexts, settlementStatusKey } from '../../interfaces/settlement-labels.util';
import { SettlementsService } from '../../services/settlements.service';
import { appLocale } from 'src/app/utils/locale-format.util';

export interface RecalculationDialogData {
  id: string;
  payoutReference: string;
  accountName: string;
  currencyIconSrc: string;
  isTextCurrency: boolean;
}

/** `applied` carries the recalculated figures so the opener can refresh without guessing. */
export type RecalculationDialogResult = { applied: true; result: PayoutRecalculation } | undefined;

interface FigureRow {
  labelKey: string;
  oldValue: number;
  newValue: number;
  /** new − old, rounded to halalas. */
  diff: number;
}

/** How an adjustment changes the payout's lines. */
type AdjustmentChange = 'new' | 'removed' | null;

const EMPTY = '-';

@Component({
  selector: 'app-recalculation-dialog',
  standalone: true,
  imports: [CommonModule, TranslateModule, TablerIconsModule],
  templateUrl: './recalculation-dialog.component.html',
  styleUrl: './recalculation-dialog.component.scss'
})
export class RecalculationDialogComponent {
  private translate = inject(TranslateService);
  private toastr = inject(ToastrService);
  private service = inject(SettlementsService);

  readonly emptyValue = EMPTY;

  loading = true;
  loadError: string | null = null;
  applying = false;
  /**
   * The dry run — or, once applied, the POST response itself: what was actually saved is
   * shown, never the preview it came from.
   */
  preview: PayoutRecalculation | null = null;
  /** Applied — the dialog stays open on the saved figures until the admin closes it. */
  applied = false;

  constructor(
    public dialogRef: MatDialogRef<RecalculationDialogComponent, RecalculationDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: RecalculationDialogData
  ) {
    dialogRef.disableClose = true;
    dialogRef.backdropClick().subscribe(() => this.close());
    dialogRef.keydownEvents().pipe(filter(e => e.key === 'Escape')).subscribe(() => this.close());
    this.load();
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  /** Dry run only — opening this dialog any number of times must not change the payout. */
  load(): void {
    this.loading = true;
    this.loadError = null;
    this.service.getRecalculation(this.data.id).subscribe({
      next: res => {
        this.preview = res;
        this.loading = false;
      },
      error: err => {
        this.preview = null;
        this.loading = false;
        this.loadError = resolveSettlementError(err, this.translate);
      },
    });
  }

  get figures(): FigureRow[] {
    const p = this.preview;
    if (!p) return [];
    const row = (labelKey: string, oldValue: number, newValue: number): FigureRow =>
      ({ labelKey, oldValue, newValue, diff: round2((newValue ?? 0) - (oldValue ?? 0)) });
    return [
      row('d3.settlements.recalc.gross', p.oldGross, p.newGross),
      row('d3.settlements.recalc.fee', p.oldFee, p.newFee),
      row('d3.settlements.recalc.net', p.oldNet, p.newNet),
    ];
  }

  /** Signed difference, e.g. "+12.50" / "−12.50"; "0.00" when unchanged. */
  fmtDiff(value: number): string {
    if (!value) return this.fmt(0);
    return `${value > 0 ? '+' : '−'}${this.fmt(Math.abs(value))}`;
  }

  /**
   * The core's raw blocker texts (technical English). The admin reads one fixed summary;
   * these only go under a collapsed "Details". Non-empty = Apply stays locked — the backend
   * doesn't refuse the POST itself, so the lock is ours.
   */
  get blockers(): string[] {
    return rawBlockerTexts(this.preview?.blockers);
  }

  /** Nothing to recalculate, yet something holds the payout (e.g. a refund under manual review). */
  get isOnHold(): boolean {
    return !!this.preview && !this.preview.hasChanges && this.blockers.length > 0;
  }

  /** Nothing to change and nothing blocking — "No changes", and no Apply button at all (guide §6.2). */
  get hasNothingToApply(): boolean {
    return !!this.preview && !this.applied && !this.preview.hasChanges && !this.blockers.length;
  }

  statusKey(status: string | null | undefined): string | null {
    return settlementStatusKey(status);
  }

  get adjustments(): RecalculationAdjustment[] {
    return this.preview?.adjustments ?? [];
  }

  get canApply(): boolean {
    return !!this.preview && !this.applied && this.preview.hasChanges && !this.blockers.length && !this.applying;
  }

  adjustmentKindKey(kind: string): string {
    return adjustmentKindKey(kind);
  }

  /**
   * `new`: the adjustment has no payout line yet (entryId explicitly null).
   * `removed`: every new figure is 0 while the line had a value — it drops out of the payout.
   */
  adjustmentChange(adj: RecalculationAdjustment): AdjustmentChange {
    if ('entryId' in adj && adj.entryId === null) return 'new';
    const isZero = (v: number | null | undefined) => typeof v === 'number' && round2(v) === 0;
    const hadValue = [adj.oldGross, adj.oldFee, adj.oldNet].some(v => typeof v === 'number' && round2(v) !== 0);
    if (hadValue && isZero(adj.newGross) && isZero(adj.newFee) && isZero(adj.newNet)) return 'removed';
    return null;
  }

  changed(oldValue: number | null | undefined, newValue: number | null | undefined): boolean {
    return typeof oldValue === 'number' && typeof newValue === 'number' && round2(oldValue) !== round2(newValue);
  }

  fmt(value: number | null | undefined): string {
    if (typeof value !== 'number') return EMPTY;
    return value.toLocaleString(appLocale(this.translate.currentLang), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  apply(): void {
    if (!this.canApply) return;
    this.applying = true;
    this.service.recalculate(this.data.id).subscribe({
      next: res => {
        this.applying = false;
        // Show what was saved (the POST response), not the preview; the opener refreshes on close.
        // applied:false = nothing needed changing by the time it ran — that reads "No changes".
        this.preview = res;
        this.applied = res.applied === true;
      },
      error: err => {
        this.applying = false;
        this.toastr.error(resolveSettlementError(err, this.translate));
        // The figures may have moved (another refund landed) — show the fresh dry run.
        this.load();
      },
    });
  }

  /** Backdrop / Esc / X / "Close" all land here — once applied, the opener must still learn it. */
  close(): void {
    if (this.applying) return;
    if (this.applied && this.preview) {
      this.dialogRef.close({ applied: true, result: this.preview });
      return;
    }
    this.dialogRef.close(undefined);
  }
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
