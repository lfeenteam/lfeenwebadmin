import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TablerIconsModule } from 'angular-tabler-icons';

/** Already-translated texts: the caller fills in version numbers and counts. */
export interface AgreementConfirmDialogData {
  title: string;
  alertTitle: string;
  alertText: string;
  heading: string;
  text: string;
  confirmLabel: string;
}

/** Red confirm (delete draft / end version). Closes with true on confirm. */
@Component({
  selector: 'app-agreement-confirm-dialog',
  standalone: true,
  imports: [TranslateModule, TablerIconsModule],
  template: `
    <section class="agd" [dir]="dir" role="alertdialog" aria-labelledby="agd-confirm-title">
      <div class="agd-body">
        <div class="agd-header">
          <h2 class="agd-title" id="agd-confirm-title">{{ data.title }}</h2>
          <button type="button" class="agd-close" (click)="ref.close(false)" [attr.aria-label]="'common.cancel' | translate">
            <i-tabler name="x"></i-tabler>
          </button>
        </div>
        <div class="agd-alert" style="margin-top: 16px">
          <strong>{{ data.alertTitle }}</strong>
          <p>{{ data.alertText }}</p>
        </div>
        @if (data.heading) {
          <h3 class="agd-heading">{{ data.heading }}</h3>
        }
        @if (data.text) {
          <p class="agd-text">{{ data.text }}</p>
        }
      </div>
      <div class="agd-footer">
        <button type="button" class="agd-btn agd-btn--danger" (click)="ref.close(true)">{{ data.confirmLabel }}</button>
        <button type="button" class="agd-btn" cdkFocusInitial (click)="ref.close(false)">{{ 'common.cancel' | translate }}</button>
      </div>
    </section>
  `,
  styleUrl: '../agreement-dialog.scss',
})
export class AgreementConfirmDialogComponent {
  readonly ref = inject(MatDialogRef<AgreementConfirmDialogComponent, boolean>);
  readonly data = inject<AgreementConfirmDialogData>(MAT_DIALOG_DATA);
  readonly dir = inject(TranslateService).currentLang === 'en' ? 'ltr' : 'rtl';
}
