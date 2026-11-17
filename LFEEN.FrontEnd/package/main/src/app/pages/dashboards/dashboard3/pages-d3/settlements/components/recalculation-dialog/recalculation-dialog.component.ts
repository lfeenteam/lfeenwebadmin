import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ToastrService } from 'ngx-toastr';
import { filter } from 'rxjs';
import { PayoutRecalculation, RecalculationAdjustment } from '../../interfaces/settlement.model';
import { resolveSettlementError } from '../../interfaces/settlement-error.util';
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
}

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
  preview: PayoutRecalculation | null = null;

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
    return [
      { labelKey: 'd3.settlements.recalc.gross', oldValue: p.oldGross, newValue: p.newGross },
      { labelKey: 'd3.settlements.recalc.fee', oldValue: p.oldFee, newValue: p.newFee },
      { labelKey: 'd3.settlements.recalc.net', oldValue: p.oldNet, newValue: p.newNet },
    ];
  }

  get blockers(): string[] {
    return (this.preview?.blockers ?? [])
      .map(b => (typeof b === 'string' ? b : b?.message ?? b?.code ?? ''))
      .map(b => String(b).trim())
      .filter(Boolean);
  }

  get adjustments(): RecalculationAdjustment[] {
    return this.preview?.adjustments ?? [];
  }

  get canApply(): boolean {
    return !!this.preview && this.preview.hasChanges && !this.blockers.length && !this.applying;
  }

  adjustmentKindKey(kind: string): string | null {
    if (kind === 'RefundAfterPayout') return 'd3.settlements.recalc.kind.refundAfterPayout';
    if (kind === 'RefundAfterSettlement') return 'd3.settlements.recalc.kind.refundAfterSettlement';
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
        this.toastr.success(this.translate.instant('d3.settlements.recalc.applied'));
        this.dialogRef.close({ applied: true, result: res });
      },
      error: err => {
        this.applying = false;
        this.toastr.error(resolveSettlementError(err, this.translate));
        // The figures may have moved (another refund landed) — show the fresh dry run.
        this.load();
      },
    });
  }

  close(): void {
    if (this.applying) return;
    this.dialogRef.close(undefined);
  }
}

const round2 = (value: number): number => Math.round(value * 100) / 100;
