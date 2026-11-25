import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DemoSignupLinksService } from '../../../../services/demo-signup-links.service';
import { DemoSignupChannels } from '../../../../interfaces/demo-signup-link.model';
import { DEMO_CHANNEL_ICONS } from '../../../../interfaces/demo-account.model';
import { readDemoError } from '../../demo-accounts.util';
import { channelMessage, signupErrorMessage } from '../demo-signup-links.util';
import { ChannelTestDialogComponent, ChannelTestDialogData } from './channel-test-dialog.component';

// Top of the sign-up links page: can SMS / Email really send now (GET channels)?
// Emits the answer so the page can turn "Create" off when nothing is ready.
@Component({
  selector: 'app-signup-channels-bar',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  template: `
    <section class="da-root scb" [attr.aria-label]="'d3.demoAccounts.signupLinks.channels.title' | translate">
      <div class="scb__head">
        <span class="scb__icon"><i-tabler name="broadcast" class="icon-18"></i-tabler></span>
        <div class="scb__titles">
          <strong>{{ 'd3.demoAccounts.signupLinks.channels.title' | translate }}</strong>
          <span>{{ 'd3.demoAccounts.signupLinks.channels.help' | translate }}</span>
        </div>
        <div class="scb__actions">
          @if (canTest) {
            <!-- Nothing ready → nothing to test; the reasons are in the tiles below. -->
            <button type="button" class="da-btn sm" [disabled]="loading || (!!channels && !channels.anyReady)"
                    [title]="(!!channels && !channels.anyReady ? 'd3.demoAccounts.signupLinks.channels.noneReady' : 'd3.demoAccounts.signupLinks.test.help') | translate"
                    (click)="openTest()">
              <i-tabler name="send" class="icon-16"></i-tabler>
              {{ 'd3.demoAccounts.signupLinks.test.open' | translate }}
            </button>
          }
          <button type="button" class="da-icon-btn" [disabled]="loading" (click)="load()"
                  [attr.aria-label]="'d3.demoAccounts.signupLinks.channels.refresh' | translate"
                  [title]="'d3.demoAccounts.signupLinks.channels.refresh' | translate">
            <i-tabler name="refresh" class="icon-18"></i-tabler>
          </button>
        </div>
      </div>

      @if (loading && !channels) {
        <div class="scb__msg"><span class="da-spin"></span> {{ 'd3.demoAccounts.signupLinks.channels.checking' | translate }}</div>
      } @else if (error) {
        <div class="scb__msg bad">
          <i-tabler name="alert-circle" class="icon-16"></i-tabler>
          <span>{{ error }}</span>
          <button type="button" class="da-link-btn" (click)="load()">{{ 'd3.demoAccounts.actions.retry' | translate }}</button>
        </div>
      } @else if (channels) {
        <div class="scb__grid" [class.stale]="loading">
          @for (row of rows; track row.key) {
            <div class="scb__tile" [class.ok]="row.state.ready" [class.bad]="!row.state.ready">
              <span class="scb__tile-icon"><i-tabler [name]="row.icon" class="icon-18"></i-tabler></span>
              <div class="scb__tile-text">
                <div class="scb__tile-top">
                  <strong>{{ ('d3.demoAccounts.channels.' + row.key) | translate }}</strong>
                  <span class="scb__pill">
                    <i-tabler [name]="row.state.ready ? 'circle-check' : 'alert-triangle'" class="icon-14"></i-tabler>
                    {{ ((row.state.ready ? 'd3.demoAccounts.signupLinks.channels.ready' : 'd3.demoAccounts.signupLinks.channels.notReady') + row.key) | translate }}
                  </span>
                </div>
                @if (!row.state.ready && message(row.state); as m) {
                  <p class="scb__reason">{{ m }}</p>
                }
              </div>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    @use '../../demo-accounts';
    :host { display: block; }
    .scb {
      display: flex; flex-direction: column; gap: 14px;
      padding: 16px 18px; border-radius: 18px; border: 1px solid #E2E8F0; background: #fff;
      box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.04);
    }
    .scb__head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .scb__icon {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center; background: #F1F5F9; color: #111110;
    }
    .scb__titles {
      display: flex; flex-direction: column; gap: 2px; flex: 1 1 220px; min-width: 0;
      strong { font-size: 15px; font-weight: 800; color: #111110; }
      span { font-size: 12px; font-weight: 500; color: #9E9E9A; }
    }
    .scb__actions { display: flex; align-items: center; gap: 6px; }
    .scb__msg {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      font-size: 13px; font-weight: 600; color: #6B6B67;
      &.bad { color: #991b1b; }
    }
    .scb__grid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
      transition: opacity 0.2s ease;
      &.stale { opacity: 0.6; }
      @media (max-width: 640px) { grid-template-columns: 1fr; }
    }
    .scb__tile {
      display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px;
      border-radius: 14px; border: 1px solid #E2E8F0; background: #F8FAFC;
      &.ok  { .scb__tile-icon { background: #dcfce7; color: #15803d; } .scb__pill { color: #15803d; background: #f0fdf4; border-color: #bbf7d0; } }
      &.bad { border-color: #fde68a; background: #fffdf5;
              .scb__tile-icon { background: #fef3c7; color: #b45309; } .scb__pill { color: #b45309; background: #fffbeb; border-color: #fde68a; } }
    }
    .scb__tile-icon {
      width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .scb__tile-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1 1 auto; }
    .scb__tile-top {
      display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;
      strong { font-size: 13px; font-weight: 800; color: #111110; }
    }
    .scb__pill {
      display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 999px;
      font-size: 11.5px; font-weight: 700; border: 1px solid transparent; white-space: nowrap;
    }
    .scb__reason { margin: 0; font-size: 12px; font-weight: 500; color: #78716c; line-height: 1.6; }
  `]
})
export class SignupChannelsBarComponent implements OnInit {
  private readonly service = inject(DemoSignupLinksService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);

  /** Shows "Try sending" (admins who can manage the screen). */
  @Input() canTest = true;
  /** The answer, or null when it could not be read. */
  @Output() readonly loaded = new EventEmitter<DemoSignupChannels | null>();
  /** errorCode of a failed read (e.g. DEMO_SIGNUP_DISABLED). */
  @Output() readonly failed = new EventEmitter<string | null>();

  channels: DemoSignupChannels | null = null;
  loading = false;
  error: string | null = null;

  get rows() {
    const c = this.channels!;
    return [
      { key: 'Sms', icon: DEMO_CHANNEL_ICONS.Sms, state: c.sms ?? { ready: false } },
      { key: 'Email', icon: DEMO_CHANNEL_ICONS.Email, state: c.email ?? { ready: false } },
    ];
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.service.channels().subscribe({
      next: c => {
        this.loading = false;
        this.channels = c;
        this.loaded.emit(c);
      },
      error: err => {
        this.loading = false;
        const e = readDemoError(err);
        this.channels = null;
        this.error = signupErrorMessage(e, this.translate);
        this.loaded.emit(null);
        this.failed.emit(e.code);
      },
    });
  }

  message(state: { ready: boolean; messageAr?: string | null; messageEn?: string | null; reason?: string | null }): string | null {
    return channelMessage(state, this.translate.currentLang || 'ar');
  }

  openTest(): void {
    if (this.channels && !this.channels.anyReady) return;
    this.dialog.open<ChannelTestDialogComponent, ChannelTestDialogData>(ChannelTestDialogComponent, {
      width: '480px',
      maxWidth: '94vw',
      direction: this.translate.currentLang === 'en' ? 'ltr' : 'rtl',
      // Only the ready channels can be picked in the dialog.
      data: { channels: this.channels },
    }).afterClosed().subscribe(() => this.load());
  }
}
