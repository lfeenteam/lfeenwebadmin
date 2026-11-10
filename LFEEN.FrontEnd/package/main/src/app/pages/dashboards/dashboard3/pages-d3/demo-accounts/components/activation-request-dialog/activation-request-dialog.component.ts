import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { ActivationRequest } from '../../../../interfaces/demo-account.model';
import { ActivationRequestPanelComponent } from '../activation-request-panel/activation-request-panel.component';

export interface ActivationRequestDialogData {
  request: ActivationRequest;
  canManage: boolean;
}

/** 'updated' carries the latest copy for the list row; 'missing' = the request is gone (reload). */
export type ActivationRequestDialogResult =
  | { type: 'updated'; request: ActivationRequest }
  | { type: 'missing' };

// One activation request in a modal. Follow-ups keep it open (the list row is
// replaced when it closes), so the admin can still read what they just saved.
@Component({
  selector: 'app-activation-request-dialog',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule, ActivationRequestPanelComponent],
  template: `
    <div class="da-root da-dialog">
      <div class="da-dialog__head">
        <span class="da-dialog__icon"><i-tabler name="user-star" class="icon-20"></i-tabler></span>
        <h2>{{ request.contactName }}</h2>
        <button type="button" class="da-icon-btn" [attr.aria-label]="'d3.demoAccounts.actions.close' | translate" (click)="close()">
          <i-tabler name="x" class="icon-18"></i-tabler>
        </button>
      </div>
      <div class="da-dialog__body">
        <app-activation-request-panel [request]="request" [canManage]="data.canManage"
                                      (changed)="onChanged($event)" (missing)="onMissing()"></app-activation-request-panel>
      </div>
    </div>
  `,
  styles: [`@use '../../demo-accounts'; :host { display: block; } .da-dialog__body { padding-bottom: 20px; }`]
})
export class ActivationRequestDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ActivationRequestDialogComponent, ActivationRequestDialogResult>);
  readonly data = inject<ActivationRequestDialogData>(MAT_DIALOG_DATA);

  request = this.data.request;
  private updated = false;

  constructor() {
    // Opened with disableClose so a backdrop click or Esc still hands back the latest copy.
    this.dialogRef.backdropClick().subscribe(() => this.close());
    this.dialogRef.keydownEvents().subscribe(e => { if (e.key === 'Escape') this.close(); });
  }

  onChanged(request: ActivationRequest): void {
    this.request = request;
    this.updated = true;
  }

  onMissing(): void {
    this.dialogRef.close({ type: 'missing' });
  }

  close(): void {
    this.dialogRef.close(this.updated ? { type: 'updated', request: this.request } : undefined);
  }
}
