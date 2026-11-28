import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { DemoSignupLinksService } from '../../../../services/demo-signup-links.service';
import { DemoSignupCancelResult } from '../../../../interfaces/demo-signup-link.model';
import { readDemoError } from '../../demo-accounts.util';
import { countText, signupErrorMessage } from '../demo-signup-links.util';

export type CancelLinksDialogData =
  /** One row's button, or the checked rows. openedCount = how many of them were opened. */
  | { mode: 'links'; linkIds: string[]; openedCount: number }
  /** Every link of a batch (opened or not). The numbers come from the batch counters when known. */
  | { mode: 'batch'; batchId: string; total: number | null; openedCount: number | null };

// The in-page confirmation before cancelling (never window.confirm). Cancelling an opened link
// stops its demo account for good, so the dialog says so. It owns the call: its buttons turn off
// while it runs, an error stays inside it, and it never retries on its own.
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

        @if (openedCount) {
          <div class="cl-stop">
            <i-tabler name="user-off" class="icon-18"></i-tabler>
            <div>
              <strong>{{ 'd3.demoAccounts.signupLinks.cancel.stopTitle' | translate: { accounts: accountsText } }}</strong>
              <span>{{ 'd3.demoAccounts.signupLinks.cancel.stopBody' | translate }}</span>
            </div>
          </div>
        }

        @if (error) {
          <div class="da-alert danger" role="alert">
            <i-tabler name="alert-circle" class="icon-18"></i-tabler>
            <p dir="auto">{{ error }}</p>
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
    .cl-stop {
      display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px; border-radius: 12px;
      background: #fef2f2; border: 1px solid #fee2e2; color: #991b1b;
      i-tabler { flex-shrink: 0; margin-top: 2px; }
      div { display: flex; flex-direction: column; gap: 2px; }
      strong { font-size: 13px; font-weight: 800; }
      span { font-size: 12px; font-weight: 600; line-height: 1.7; }
    }
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

  /** How many opened links (= running accounts) this would stop; null when unknown. */
  get openedCount(): number | null {
    return this.data.openedCount;
  }

  get accountsText(): string {
    return countText(this.openedCount ?? 0, 'account', this.translate);
  }

  /** The guide's sentence: «سيتم إلغاء {n} رابط. الروابط التي فُتحت سيتوقف حسابها التجريبي…». */
  get message(): string {
    const key = 'd3.demoAccounts.signupLinks.cancel';
    const total = this.data.mode === 'batch' ? this.data.total : this.data.linkIds.length;
    if (this.data.mode === 'batch' && total == null) return this.translate.instant(`${key}.batchBodyNoCount`);
    return this.translate.instant(`${key}.body`, { links: countText(total ?? 0, 'link', this.translate) });
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
        this.dialogRef.close(res ?? { cancelled: 0, accountsStopped: 0, skipped: 0, cancelledIds: [] });
      },
      error: err => {
        this.submitting = false;
        this.error = signupErrorMessage(readDemoError(err), this.translate);
      },
    });
  }
}
