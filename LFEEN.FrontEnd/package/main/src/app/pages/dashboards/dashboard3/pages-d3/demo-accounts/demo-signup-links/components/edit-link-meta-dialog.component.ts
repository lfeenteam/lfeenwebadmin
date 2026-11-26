import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { DemoSignupLinksService } from '../../../../services/demo-signup-links.service';
import {
  DEMO_SIGNUP_LIMITS,
  DEMO_SIGNUP_TEXT_FORBIDDEN,
  DemoSignupBatch,
  DemoSignupLink,
  UpdateDemoSignupMetaRequest
} from '../../../../interfaces/demo-signup-link.model';
import { readDemoError } from '../../demo-accounts.util';
import { signupErrorMessage } from '../demo-signup-links.util';

type MetaField = 'area' | 'additionalNotes';
const FIELDS: MetaField[] = ['area', 'additionalNotes'];

export type EditLinkMetaDialogData =
  /** One link. batchValues = its batch's area / notes when known (from the batches list). */
  | { mode: 'link'; link: DemoSignupLink; batchValues: { area: string | null; additionalNotes: string | null } | null }
  | { mode: 'batch'; batch: DemoSignupBatch };

export type EditLinkMetaDialogResult =
  | { mode: 'link'; link: DemoSignupLink }
  | { mode: 'batch'; batch: DemoSignupBatch };

interface FieldState {
  /** Link mode: the link follows the batch's value (no own value). */
  inherit: boolean;
  value: string;
  error: string | null;
}

// "Edit area / notes" (guide §4) for one link (PATCH {linkId}) or a whole batch
// (PATCH batches/{batchId}). Admin-only fields — never shown to the organisation. On a link,
// "Use the batch value" sends "" (the link drops its own value); only changed fields are sent.
@Component({
  selector: 'app-edit-link-meta-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, TablerIconsModule, TranslateModule],
  template: `
    <form class="da-root da-dialog" novalidate autocomplete="off" (ngSubmit)="save()" [dir]="lang === 'en' ? 'ltr' : 'rtl'">
      <div class="da-dialog__head">
        <span class="da-dialog__icon"><i-tabler name="pencil" class="icon-20"></i-tabler></span>
        <h2>{{ (data.mode === 'batch' ? 'd3.demoAccounts.signupLinks.edit.batchTitle' : 'd3.demoAccounts.signupLinks.edit.title') | translate }}</h2>
      </div>

      <div class="da-dialog__body">
        <div class="em-private">
          <i-tabler name="eye-off" class="icon-16"></i-tabler>
          <p>{{ (data.mode === 'batch' ? 'd3.demoAccounts.signupLinks.edit.batchHelp' : 'd3.demoAccounts.signupLinks.edit.help') | translate }}</p>
        </div>

        @for (f of fields; track f) {
          @let s = state[f];
          <div class="da-field">
            <label [for]="'em-' + f">{{ ('d3.demoAccounts.signupLinks.create.' + f) | translate }}</label>

            @if (isLink && s.inherit) {
              <!-- Follows the batch: show the batch value, offer to give this link its own -->
              <div class="em-inherit">
                <span class="em-tag">{{ 'd3.demoAccounts.signupLinks.table.fromBatch' | translate }}</span>
                <span class="em-inherit__value" dir="auto">{{ batchValue(f) || ('d3.demoAccounts.signupLinks.edit.batchEmpty' | translate) }}</span>
                <button type="button" class="da-link-btn" [disabled]="saving" (click)="customize(f)">
                  {{ 'd3.demoAccounts.signupLinks.edit.customize' | translate }}
                </button>
              </div>
            } @else {
              @if (f === 'area') {
                <input [id]="'em-' + f" name="em-area" class="da-input" type="text"
                       [placeholder]="'d3.demoAccounts.signupLinks.create.areaPlaceholder' | translate"
                       [class.invalid]="s.error" [disabled]="saving" [(ngModel)]="s.value" (ngModelChange)="s.error = null" />
              } @else {
                <textarea [id]="'em-' + f" name="em-notes" class="da-input" rows="3"
                          [placeholder]="'d3.demoAccounts.signupLinks.create.additionalNotesPlaceholder' | translate"
                          [class.invalid]="s.error" [disabled]="saving" [(ngModel)]="s.value" (ngModelChange)="s.error = null"></textarea>
              }
              <div class="em-under">
                @if (s.error) { <span class="da-error">{{ s.error }}</span> } @else { <span></span> }
                <span class="em-under__end">
                  @if (isLink) {
                    <button type="button" class="da-link-btn" [disabled]="saving" (click)="useBatch(f)">
                      {{ 'd3.demoAccounts.signupLinks.edit.useBatch' | translate }}
                    </button>
                  }
                  <span class="da-ltr" dir="ltr">{{ s.value.trim().length }}/{{ max(f) }}</span>
                </span>
              </div>
            }
          </div>
        }

        @if (error) {
          <div class="da-alert danger" role="alert">
            <i-tabler name="alert-circle" class="icon-18"></i-tabler>
            <p>{{ error }}</p>
          </div>
        }
      </div>

      <div class="da-dialog__footer">
        <button type="button" class="da-btn" [disabled]="saving" (click)="close()">{{ 'd3.demoAccounts.actions.cancel' | translate }}</button>
        <button type="submit" class="da-btn primary" [disabled]="saving">
          @if (saving) { <span class="da-spin"></span> } @else { <i-tabler name="check" class="icon-16"></i-tabler> }
          {{ 'd3.demoAccounts.signupLinks.edit.save' | translate }}
        </button>
      </div>
    </form>
  `,
  styles: [`
    @use '../../demo-accounts';
    .da-field { gap: 8px; }
    .em-private {
      display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; border-radius: 12px;
      background: #F8FAFC; border: 1px solid #E2E8F0; color: #45556C;
      i-tabler { flex-shrink: 0; margin-top: 2px; }
      p { margin: 0; font-size: 12px; font-weight: 600; line-height: 1.7; }
    }
    .em-inherit {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-height: 44px; padding: 8px 12px;
      border-radius: 12px; border: 1px dashed #CBD5E1; background: #F8FAFC;
      .da-link-btn { margin-inline-start: auto; font-size: 12px; }
    }
    .em-inherit__value { font-size: 13px; font-weight: 600; color: #45556C; word-break: break-word; flex: 1 1 160px; }
    .em-tag {
      padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
      color: #6d28d9; background: #f5f3ff; border: 1px solid #ede9fe; white-space: nowrap;
    }
    .em-under {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 8px;
      font-size: 11px; font-weight: 600; color: #9E9E9A;
      &__end { display: inline-flex; align-items: center; gap: 12px; flex-shrink: 0; }
      .da-link-btn { font-size: 11.5px; color: #45556C; }
    }
  `]
})
export class EditLinkMetaDialogComponent {
  readonly data = inject<EditLinkMetaDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EditLinkMetaDialogComponent, EditLinkMetaDialogResult>);
  private readonly service = inject(DemoSignupLinksService);
  private readonly translate = inject(TranslateService);

  readonly lang = this.translate.currentLang || 'ar';
  readonly fields = FIELDS;
  readonly isLink = this.data.mode === 'link';

  /** What the fields held when the dialog opened — only changes are sent. */
  private readonly initial: Record<MetaField, FieldState> = this.data.mode === 'link'
    ? {
        area: { inherit: this.data.link.areaFromBatch, value: this.data.link.areaFromBatch ? '' : (this.data.link.area ?? ''), error: null },
        additionalNotes: {
          inherit: this.data.link.additionalNotesFromBatch,
          value: this.data.link.additionalNotesFromBatch ? '' : (this.data.link.additionalNotes ?? ''),
          error: null,
        },
      }
    : {
        area: { inherit: false, value: this.data.batch.area ?? '', error: null },
        additionalNotes: { inherit: false, value: this.data.batch.additionalNotes ?? '', error: null },
      };

  readonly state: Record<MetaField, FieldState> = {
    area: { ...this.initial.area },
    additionalNotes: { ...this.initial.additionalNotes },
  };

  saving = false;
  error: string | null = null;

  max(f: MetaField): number {
    return DEMO_SIGNUP_LIMITS[f];
  }

  /** The batch's value: from the batches list, or the link's own copy while it inherits it. */
  batchValue(f: MetaField): string | null {
    if (this.data.mode !== 'link') return null;
    const fromList = this.data.batchValues?.[f];
    if (fromList !== undefined && fromList !== null) return fromList;
    const inherits = f === 'area' ? this.data.link.areaFromBatch : this.data.link.additionalNotesFromBatch;
    return inherits ? this.data.link[f] : null;
  }

  /** Give this link its own value, starting from the batch's. */
  customize(f: MetaField): void {
    this.state[f] = { inherit: false, value: this.batchValue(f) ?? '', error: null };
  }

  /** Drop this link's own value and follow the batch again (sends ""). */
  useBatch(f: MetaField): void {
    this.state[f] = { inherit: true, value: '', error: null };
  }

  close(): void {
    if (!this.saving) this.dialogRef.close();
  }

  save(): void {
    if (this.saving) return;
    this.error = null;
    let invalid = false;
    for (const f of FIELDS) {
      const s = this.state[f];
      s.error = s.inherit ? null : this.validate(f, s.value.trim());
      if (s.error) invalid = true;
    }
    if (invalid) return;

    const body = this.changes();
    if (!Object.keys(body).length) {
      this.dialogRef.close();
      return;
    }

    this.saving = true;
    const request: Observable<DemoSignupLink | DemoSignupBatch> = this.data.mode === 'link'
      ? this.service.updateLink(this.data.link.id, body)
      : this.service.updateBatch(this.data.batch.id, body);
    request.subscribe({
      next: res => {
        this.saving = false;
        this.dialogRef.close(this.data.mode === 'link'
          ? { mode: 'link', link: res as DemoSignupLink }
          : { mode: 'batch', batch: res as DemoSignupBatch });
      },
      error: err => {
        this.saving = false;
        const e = readDemoError(err);
        if (e.code !== 'VALIDATION_ERROR') {
          // DEMO_SIGNUP_LINK_ID_NOT_FOUND / DEMO_SIGNUP_BATCH_NOT_FOUND / …: the server's sentence.
          this.error = signupErrorMessage(e, this.translate);
          return;
        }
        // 400 VALIDATION_ERROR: our own text under the field it names (the server's may be English).
        let unplaced = !e.fieldErrors.length;
        for (const fe of e.fieldErrors) {
          const f = FIELDS.find(x => x.toLowerCase() === fe.field);
          if (f) this.state[f].error = this.validate(f, this.state[f].value.trim()) ?? this.ruleMessage(f);
          else unplaced = true;
        }
        if (unplaced) this.error = this.translate.instant('d3.demoAccounts.signupLinks.errors.validation');
      },
    });
  }

  /** Only what changed: a field the admin left alone is not sent; "" clears / follows the batch. */
  private changes(): UpdateDemoSignupMetaRequest {
    const body: UpdateDemoSignupMetaRequest = {};
    for (const f of FIELDS) {
      const now = this.state[f];
      const was = this.initial[f];
      if (now.inherit) {
        if (!was.inherit) body[f] = '';
      } else {
        const value = now.value.trim();
        if (was.inherit || value !== was.value.trim()) body[f] = value;
      }
    }
    return body;
  }

  /** The field's rule as one sentence (up to N characters, no < or >). */
  private ruleMessage(f: MetaField): string {
    return this.translate.instant(`d3.demoAccounts.signupLinks.validation.${f}Rule`, { max: DEMO_SIGNUP_LIMITS[f] });
  }

  private validate(f: MetaField, value: string): string | null {
    const t = (key: string, params?: object) => this.translate.instant(`d3.demoAccounts.signupLinks.validation.${key}`, params);
    if (value.length > DEMO_SIGNUP_LIMITS[f]) return t(`${f}Max`, { max: DEMO_SIGNUP_LIMITS[f] });
    return DEMO_SIGNUP_TEXT_FORBIDDEN.test(value) ? t('textChars') : null;
  }
}
