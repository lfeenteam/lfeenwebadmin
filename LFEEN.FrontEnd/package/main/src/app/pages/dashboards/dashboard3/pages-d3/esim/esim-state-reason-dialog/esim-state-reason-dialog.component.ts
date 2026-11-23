import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ESIM_STATE_REASON_MAX_LENGTH } from '../interfaces/esim.model';
import { resolveEsimError } from '../interfaces/esim-error.util';
import { EsimService } from '../services/esim.service';

/** Only the actions that need a reason open this dialog; unsuspend runs directly. */
export type EsimReasonAction = 'suspend' | 'revoke';

export interface EsimStateReasonDialogData {
  esimId: string;
  action: EsimReasonAction;
  /** Shown in the description so support can tell which SIM they're acting on. */
  simLabel: string;
}

/**
 * changed = done; refresh = no answer from the server (the action may have gone through),
 * so the caller should re-fetch.
 */
export type EsimStateReasonResult = { kind: 'changed' } | { kind: 'refresh' };

/**
 * Asks for the (required) support reason before suspending or revoking a SIM, and sends the
 * request itself so a rejected request can be fixed without reopening. Revoke is final, so it
 * also carries the "can't be undone" warning that used to be a separate confirm dialog.
 */
@Component({
  selector: 'app-esim-state-reason-dialog',
  standalone: true,
  imports: [FormsModule, TablerIconsModule, TranslateModule],
  templateUrl: './esim-state-reason-dialog.component.html',
  styleUrls: ['../esim-refund-dialog/esim-refund-dialog.component.scss', './esim-state-reason-dialog.component.scss'],
})
export class EsimStateReasonDialogComponent {
  private dialogRef = inject(MatDialogRef<EsimStateReasonDialogComponent, EsimStateReasonResult | undefined>);
  readonly data = inject<EsimStateReasonDialogData>(MAT_DIALOG_DATA);
  private service = inject(EsimService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  readonly maxLength = ESIM_STATE_REASON_MAX_LENGTH;
  reason = '';
  submitting = false;
  submitted = false;
  serverError: string | null = null;
  private stale = false;

  get isRevoke(): boolean {
    return this.data.action === 'revoke';
  }

  get currentDir(): 'rtl' | 'ltr' {
    return this.translate.currentLang === 'en' ? 'ltr' : 'rtl';
  }

  get reasonError(): string | null {
    return this.reason.trim() ? null : 'd3.esim.stateReason.errors.reasonRequired';
  }

  submit(): void {
    this.submitted = true;
    if (this.submitting || this.reasonError) return;
    this.submitting = true;
    this.serverError = null;
    this.service.changeState(this.data.esimId, this.data.action, this.reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.dialogRef.close({ kind: 'changed' }),
        error: (err: HttpErrorResponse) => {
          this.submitting = false;
          // A timeout or dropped connection may still have reached the provider — don't invite a blind resend.
          if (!err?.status) {
            this.stale = true;
            this.serverError = this.translate.instant('d3.esim.stateReason.errors.uncertain');
            return;
          }
          this.serverError = resolveEsimError(err, this.translate);
        },
      });
  }

  close(): void {
    if (this.submitting) return;
    this.dialogRef.close(this.stale ? { kind: 'refresh' } : undefined);
  }
}
