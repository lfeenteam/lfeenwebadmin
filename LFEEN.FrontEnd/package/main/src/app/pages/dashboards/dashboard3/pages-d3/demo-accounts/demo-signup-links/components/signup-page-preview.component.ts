import { Component, DestroyRef, DoCheck, Input, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { DemoAccountsService } from '../../../../services/demo-accounts.service';
import { DemoAccountKind, InvitationVariable } from '../../../../interfaces/demo-account.model';
import { InvitationEditorStore } from '../../components/invitation-editor/invitation-editor.store';

// What the organisation sees when it opens a demo link (client web, guide §5): the sign-in card
// with example values and the welcome message under it. Nothing is sent by SMS or email any more,
// so this replaces the Email / SMS preview tabs. The text comes from POST invitation-preview
// (same InvitationEditorStore as the editor), rendered with example sign-in data.
@Component({
  selector: 'app-signup-page-preview',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  template: `
    <aside class="da-root spp" [attr.aria-label]="'d3.demoAccounts.signupLinks.preview.title' | translate">
      <div class="spp__head">
        <span class="spp__head-icon"><i-tabler name="eye" class="icon-16"></i-tabler></span>
        <div class="spp__head-text">
          <strong>{{ 'd3.demoAccounts.signupLinks.preview.title' | translate }}</strong>
          <span>{{ 'd3.demoAccounts.signupLinks.preview.subtitle' | translate }}</span>
        </div>
        <span class="spp__live" [class.loading]="store.previewLoading">
          @if (store.previewLoading) { <span class="da-spin"></span> } @else { <span class="spp__dot"></span> }
          {{ (store.previewLoading ? 'd3.demoAccounts.invitation.updating' : 'd3.demoAccounts.invitation.live') | translate }}
        </span>
      </div>

      <!-- A small browser frame around the page -->
      <div class="spp__browser">
        <div class="spp__bar" aria-hidden="true">
          <span class="spp__dots"><i></i><i></i><i></i></span>
          <span class="spp__url" dir="ltr"><i-tabler name="lock" class="icon-12"></i-tabler> lfeen.com/demo-signup/…</span>
        </div>

        <div class="spp__page">
          <div class="spp__card">
            <div class="spp__card-head">
              <span class="spp__party">🎉</span>
              <div>
                <strong>{{ 'd3.demoAccounts.signupLinks.preview.ready' | translate }}</strong>
                <span class="spp__name" dir="auto">{{ accountName }}</span>
              </div>
              <span class="spp__days">{{ 'd3.demoAccounts.signupLinks.preview.daysLeft' | translate: { days: days || 0 } }}</span>
            </div>

            @if (rows.length) {
              <dl class="spp__rows">
                @for (v of rows; track v.number) {
                  <div class="spp__row">
                    <dt>{{ store.variableLabel(v) }}</dt>
                    <dd>
                      <span class="da-ltr" dir="ltr">{{ value(v) }}</span>
                      <i-tabler name="copy" class="icon-14 spp__copy" aria-hidden="true"></i-tabler>
                    </dd>
                  </div>
                }
              </dl>
            } @else {
              <div class="spp__skel"><i></i><i></i><i></i><i></i></div>
            }

            <div class="spp__actions" aria-hidden="true">
              <span class="spp__btn">{{ 'd3.demoAccounts.signupLinks.preview.copyAll' | translate }}</span>
              <span class="spp__btn primary">{{ 'd3.demoAccounts.signupLinks.preview.signIn' | translate }}</span>
            </div>
            <p class="spp__keep">💡 {{ 'd3.demoAccounts.signupLinks.preview.keep' | translate }}</p>
          </div>

          <!-- The welcome message (copied with "copy all") -->
          <div class="spp__welcome" [class.stale]="store.previewLoading">
            <span class="spp__welcome-label">
              <i-tabler name="message-2" class="icon-14"></i-tabler>
              {{ 'd3.demoAccounts.signupLinks.preview.welcome' | translate }}
            </span>
            @if (store.previewError) {
              <p class="da-error">{{ store.previewError }}
                <button type="button" class="da-link-btn" (click)="store.refresh()">{{ 'd3.demoAccounts.actions.retry' | translate }}</button>
              </p>
            } @else if (welcomeText) {
              <div class="spp__text" dir="auto">{{ welcomeText }}</div>
            } @else {
              <div class="spp__skel"><i></i><i></i><i></i></div>
            }
          </div>
        </div>
      </div>

      @if (store.preview?.isValid === false && !store.previewLoading) {
        <div class="da-alert danger spp__note">
          <i-tabler name="alert-circle" class="icon-16"></i-tabler>
          <p>{{ 'd3.demoAccounts.invitation.invalid' | translate }}</p>
        </div>
      }
      <p class="spp__hint">
        <i-tabler name="info-circle" class="icon-14"></i-tabler>
        {{ 'd3.demoAccounts.signupLinks.preview.examples' | translate }}
      </p>
    </aside>
  `,
  styles: [`
    @use '../../demo-accounts';
    :host { display: block; }
    .spp {
      background: #fff; border: 1px solid #E2E8F0; border-radius: 18px; padding: 16px;
      display: flex; flex-direction: column; gap: 14px;
      box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.04);
    }
    .spp__head { display: flex; align-items: center; gap: 10px; }
    .spp__head-icon {
      width: 32px; height: 32px; border-radius: 10px; background: #F1F5F9; color: #111110;
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .spp__head-text { display: flex; flex-direction: column; min-width: 0; flex: 1 1 auto;
      strong { font-size: 14px; font-weight: 800; color: #111110; }
      span { font-size: 11.5px; font-weight: 500; color: #9E9E9A; }
    }
    .spp__live {
      display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 700; color: #45556C; background: #F8FAFC; border: 1px solid #E2E8F0; white-space: nowrap;
      .da-spin { width: 10px; height: 10px; border-width: 1.5px; }
    }
    .spp__dot { width: 6px; height: 6px; border-radius: 50%; background: #111110; }

    .spp__browser { border: 1px solid #E2E8F0; border-radius: 14px; overflow: hidden; background: #F8FAFC; }
    .spp__bar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #fff; border-bottom: 1px solid #F1F5F9; }
    .spp__dots { display: inline-flex; gap: 4px; i { width: 7px; height: 7px; border-radius: 50%; background: #E2E8F0; } }
    .spp__url {
      flex: 1 1 auto; display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px;
      background: #F1F5F9; color: #6B6B67; font-size: 11px; font-weight: 600; overflow: hidden; white-space: nowrap;
    }
    .spp__page { padding: 14px; display: flex; flex-direction: column; gap: 12px; }

    .spp__card {
      background: #fff; border-radius: 14px; border: 1px solid #E2E8F0; padding: 14px;
      display: flex; flex-direction: column; gap: 12px;
    }
    .spp__card-head { display: flex; align-items: flex-start; gap: 10px;
      > div { display: flex; flex-direction: column; gap: 2px; flex: 1 1 auto; min-width: 0; }
      strong { font-size: 14px; font-weight: 800; color: #111110; }
    }
    .spp__party { font-size: 20px; line-height: 1; }
    .spp__name { font-size: 12px; font-weight: 700; color: #45556C; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .spp__days {
      flex-shrink: 0; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 800;
      color: #15803d; background: #f0fdf4; border: 1px solid #dcfce7; white-space: nowrap;
    }
    .spp__rows { margin: 0; display: flex; flex-direction: column; }
    .spp__row {
      display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0;
      border-top: 1px dashed #F1F5F9;
      dt { font-size: 12px; font-weight: 600; color: #6B6B67; }
      dd { margin: 0; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; color: #111110; }
    }
    .spp__copy { color: #94a3b8; }
    .spp__actions { display: flex; gap: 8px; }
    .spp__btn {
      flex: 1 1 0; height: 34px; border-radius: 10px; border: 1px solid #E2E8F0; background: #fff;
      display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #111110;
      &.primary { background: #111110; border-color: #111110; color: #fff; }
    }
    .spp__keep { margin: 0; font-size: 11.5px; font-weight: 600; color: #6B6B67; line-height: 1.6; }

    .spp__welcome {
      background: #fff; border-radius: 14px; border: 1px solid #E2E8F0; padding: 12px 14px;
      display: flex; flex-direction: column; gap: 8px; transition: opacity 0.2s ease;
      &.stale { opacity: 0.6; }
    }
    .spp__welcome-label { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 800; color: #6B6B67; }
    .spp__text {
      white-space: pre-wrap; word-break: break-word; font-size: 12.5px; line-height: 1.8; color: #111110;
      max-height: 320px; overflow-y: auto;
    }
    .spp__skel { display: flex; flex-direction: column; gap: 8px;
      i { height: 10px; border-radius: 6px; background: #F1F5F9; }
      i:nth-child(2) { width: 80%; } i:nth-child(3) { width: 60%; }
    }
    .spp__note { padding: 10px 12px; font-size: 12px; }
    .spp__hint { margin: 0; display: flex; align-items: flex-start; gap: 6px; font-size: 11.5px; font-weight: 500; color: #9E9E9A; line-height: 1.6;
      i-tabler { flex-shrink: 0; margin-top: 2px; }
    }
  `]
})
export class SignupPagePreviewComponent implements DoCheck {
  readonly store = inject(InvitationEditorStore);
  private readonly translate = inject(TranslateService);
  private readonly service = inject(DemoAccountsService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The card's values as the server fills them (same examples as the welcome text — e.g. the
   * real verification code), keyed by variable key. Until they arrive, the variables' own examples.
   */
  private serverValues = new Map<string, string>();
  private valuesKey: string | null = null;
  private valuesRequest?: Subscription;

  /** Asks the server for the card's example values whenever the kind, language or variables change. */
  ngDoCheck(): void {
    const rows = this.rows;
    if (!rows.length) return;
    const key = `${this.store.kind}|${this.store.language}|${rows.map(v => v.key).join(',')}`;
    if (key === this.valuesKey) return;
    this.valuesKey = key;
    this.valuesRequest?.unsubscribe();
    // One token per line, so line n of the rendered text is the value of row n.
    this.valuesRequest = this.service.previewInvitation({
      invitationMessage: rows.map(v => this.store.tokenOf(v)).join('\n'),
      invitationLanguage: this.store.language,
      kind: this.store.kind,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: p => {
        const lines = (p.whatsApp?.body ?? p.sms?.body ?? '').split('\n').map(l => l.trim());
        const values = new Map<string, string>();
        if (lines.length >= rows.length) rows.forEach((v, i) => lines[i] && values.set(v.key, lines[i]));
        this.serverValues = values;
      },
      error: () => (this.serverValues = new Map()),
    });
  }

  value(v: InvitationVariable): string {
    return this.serverValues.get(v.key) ?? this.store.variableExample(v);
  }

  /** The organisation name typed in the form (the account's name). */
  @Input() label = '';
  @Input() kind: DemoAccountKind = 'Merchant';
  @Input() days: number | null = null;

  /** Like the account names: the label, else "Demo account". */
  get accountName(): string {
    return this.label.trim() || this.translate.instant('d3.demoAccounts.signupLinks.preview.defaultName');
  }

  /**
   * The card's rows: the sign-in variables with their example values (login number, ID,
   * code, PIN, and the birth date for a guest). The login link is the "Sign in" button instead.
   */
  get rows(): InvitationVariable[] {
    return this.store.variables.filter(v => v.isCredential && !/url|link/i.test(v.key));
  }

  /** The welcome text as the page shows it (plain text, sign-in data filled with examples). */
  get welcomeText(): string | null {
    const p = this.store.preview;
    return p?.whatsApp?.body ?? p?.sms?.body ?? p?.email?.body ?? null;
  }
}
