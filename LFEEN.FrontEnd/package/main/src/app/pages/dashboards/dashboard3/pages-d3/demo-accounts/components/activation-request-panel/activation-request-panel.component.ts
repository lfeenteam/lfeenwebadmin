import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { formatLocalizedNumber } from 'src/app/utils/pagination.util';
import { DemoAccountsService } from '../../../../services/demo-accounts.service';
import {
  ACTIVATION_NOTE_MAX,
  ActivationRequest,
  ActivationRequestStatus,
  toLocalPhone
} from '../../../../interfaces/demo-account.model';
import { DemoApiError, demoErrorMessage, formatRiyadhDate, readDemoError } from '../../demo-accounts.util';

/** The follow-up buttons, in display order. */
const FOLLOW_UPS: { status: ActivationRequestStatus; icon: string; primary?: boolean }[] = [
  { status: 'Contacted', icon: 'phone-check', primary: true },
  { status: 'Converted', icon: 'user-check' },
  { status: 'Closed', icon: 'circle-x' },
  { status: 'New', icon: 'arrow-back-up' },
];

// One activation request: contact data, the trial summary and the follow-up actions.
// Used in the requests tab (inside a dialog) and as a card on the account details page.
@Component({
  selector: 'app-activation-request-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TablerIconsModule, TranslateModule],
  templateUrl: './activation-request-panel.component.html',
  styleUrl: './activation-request-panel.component.scss'
})
export class ActivationRequestPanelComponent {
  private readonly service = inject(DemoAccountsService);
  private readonly translate = inject(TranslateService);
  private readonly toastr = inject(ToastrService);

  @Input({ required: true }) request!: ActivationRequest;
  /** Without DemoAccounts.Manage the follow-up buttons are hidden. */
  @Input() canManage = false;
  /** The link to the demo account (hidden when already on its page). */
  @Input() showAccountLink = true;

  /** The request after a follow-up — the parent replaces its copy with it. */
  @Output() changed = new EventEmitter<ActivationRequest>();
  /** The request no longer exists (404) — the parent reloads. */
  @Output() missing = new EventEmitter<DemoApiError>();

  readonly noteMax = ACTIVATION_NOTE_MAX;
  readonly lang = this.translate.currentLang || 'ar';

  adminNote = '';
  saving: ActivationRequestStatus | null = null;
  error: string | null = null;
  noteError: string | null = null;

  /** Every follow-up except the current status. */
  get followUps(): typeof FOLLOW_UPS {
    return FOLLOW_UPS.filter(f => f.status !== this.request.status);
  }

  get trialStats(): { key: string; value: number }[] {
    const t = this.request.trial;
    return [
      { key: 'daysUsed', value: t.daysUsed },
      { key: 'properties', value: t.propertiesCount },
      { key: 'units', value: t.unitsCount },
      { key: 'bookings', value: t.bookingsCount },
      { key: 'payments', value: t.paymentsCount },
      { key: 'customers', value: t.customersCount },
      { key: 'services', value: t.servicesCount },
    ];
  }

  setStatus(status: ActivationRequestStatus): void {
    if (this.saving || !this.canManage) return;
    const note = this.adminNote.trim();
    if (note.length > ACTIVATION_NOTE_MAX) {
      this.noteError = this.translate.instant('d3.demoAccounts.activation.noteMax');
      return;
    }
    this.saving = status;
    this.error = null;
    this.noteError = null;

    // An empty note keeps the saved one, so it is left out.
    this.service.updateActivationRequestStatus(this.request.id, { status, ...(note ? { adminNote: note } : {}) }).subscribe({
      next: updated => {
        this.saving = null;
        this.adminNote = '';
        this.request = updated;
        this.changed.emit(updated);
        this.toastr.success(this.translate.instant('d3.demoAccounts.activation.updated', {
          status: this.translate.instant(`d3.demoAccounts.activation.status.${updated.status}`),
        }));
      },
      error: err => {
        this.saving = null;
        const e = readDemoError(err);
        if (e.code === 'DEMO_ACTIVATION_REQUEST_NOT_FOUND' || (!e.code && e.status === 404)) {
          this.toastr.error(this.translate.instant('d3.demoAccounts.errors.DEMO_ACTIVATION_REQUEST_NOT_FOUND'));
          this.missing.emit(e);
          return;
        }
        if (e.code === 'VALIDATION_ERROR' && e.fieldErrors.length) {
          const rest: string[] = [];
          for (const fe of e.fieldErrors) {
            if (fe.field === 'adminnote') this.noteError = fe.message;
            else rest.push(fe.message);
          }
          this.error = rest.join(' - ') || null;
          return;
        }
        this.error = demoErrorMessage(e, this.translate);
      },
    });
  }

  // ── Display helpers ────────────────────────────────────────

  phone(value: string | null): string | null {
    return toLocalPhone(value);
  }

  date(value: string | null, withTime = true): string | null {
    return formatRiyadhDate(value, this.lang, withTime);
  }

  num(value: number): string {
    return formatLocalizedNumber(value ?? 0, this.lang);
  }
}
