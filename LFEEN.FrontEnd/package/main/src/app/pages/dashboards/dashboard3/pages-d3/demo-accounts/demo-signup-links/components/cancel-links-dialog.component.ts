import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { DemoSignupLinksService } from '../../../../services/demo-signup-links.service';
import { DemoSignupCancelResult } from '../../../../interfaces/demo-signup-link.model';
import { readDemoError } from '../../demo-accounts.util';
import { signupErrorMessage } from '../demo-signup-links.util';

export type CancelLinksDialogData =
  /** One row's button, or the checked rows. */
  | { mode: 'links'; linkIds: string[] }
  /** Every Open link of a batch. openLinks = what the batch counted when shown. */
  | { mode: 'batch'; batchId: string; openLinks?: number | null };

// The in-page confirmation before cancelling (never window.confirm). The dialog owns the call:
// its buttons turn off while it runs, an error stays inside it, and it never retries on its own.
@Component({
  selector: 'app-cancel-links-dialog',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  template: `
    <div class="da-root da-dialog" [dir]="lang === 'en' ? 'ltr' : 'rtl'">
      <div class="da-dialog__head">
        <span class="da-dialog__icon danger"><i-tabler name="link-off" class="icon-20"></i-tabler></span>
        <h2>{{ (data.mode === 'batch' ? 'd3.demoAccounts.signupLinks.cancel.batchTitle' : 'd3.demoAccounts.signupLinks.cancel.title') | translate }}</h2>
      </div>
      <div class="da-dialog__body">
        <p>{{ message }}</p>
        <p class="cl-note">{{ 'd3.demoAccounts.signupLinks.cancel.note' | translate }}</p>
        @if (error) {
          <div class="da-alert danger" role="alert">
            <i-tabler name="alert-circle" class="icon-18"></i-tabler>
            <p>{{ error }}</p>
          </div>
        }
      </div>
      <div class="da-dialog__footer">
        <button type="button" class="da-btn" [disabled]="submitting" (click)="close()">{{ 'd3.demoAccounts.signupLinks.cancel.keep' | translate }}</button>
        <button type="button" class="da-btn danger" [disabled]="submitting" (click)="confirm()">
          @if (submitting) { <span class="da-spin"></span> } @else { <i-tabler name="link-off" class="icon-16"></i-tabler> }
          {{ 'd3.demoAccounts.signupLinks.cancel.confirm' | translate }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    @use '../../demo-accounts';
    .cl-note { color: #9E9E9A !important; font-size: 12px !important; }
  `]
})
export class CancelLinksDialogComponent {
  readonly data = inject<CancelLinksDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<CancelLinksDialogComponent, DemoSignupCancelResult>);
  private readonly service = inject(DemoSignupLinksService);
  private readonly translate = inject(TranslateService);

  readonly lang = this.translate.currentLang || 'ar';
  submitting = false;
  error: string | null = null;

  get message(): string {
    const key = 'd3.demoAccounts.signupLinks.cancel';
    if (this.data.mode === 'batch') {
      return this.data.openLinks != null
        ? this.translate.instant(`${key}.batchBody`, { count: this.data.openLinks })
        : this.translate.instant(`${key}.batchBodyNoCount`);
    }
    return this.data.linkIds.length === 1
      ? this.translate.instant(`${key}.bodyOne`)
      : this.translate.instant(`${key}.bodyMany`, { count: this.data.linkIds.length });
  }

  close(): void {
    if (!this.submitting) this.dialogRef.close();
  }

  confirm(): void {
    if (this.submitting) return;
    const request: Observable<DemoSignupCancelResult> = this.data.mode === 'batch'
      ? this.service.cancelBatch(this.data.batchId)
      : this.service.cancel(this.data.linkIds);
    this.submitting = true;
    this.error = null;
    request.subscribe({
      next: res => {
        this.submitting = false;
        this.dialogRef.close(res ?? { cancelled: 0, skipped: 0, cancelledIds: [] });
      },
      error: err => {
        this.submitting = false;
        this.error = signupErrorMessage(readDemoError(err), this.translate);
      },
    });
  }
}
