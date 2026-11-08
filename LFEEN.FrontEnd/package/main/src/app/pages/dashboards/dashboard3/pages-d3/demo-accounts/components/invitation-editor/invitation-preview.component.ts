import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TablerIconsModule } from 'angular-tabler-icons';
import { TranslateModule } from '@ngx-translate/core';
import { DEMO_CHANNEL_ICONS, DemoChannel } from '../../../../interfaces/demo-account.model';
import { InvitationEditorStore } from './invitation-editor.store';

// The server-rendered invitation in three tabs (Email · WhatsApp · SMS), plus the
// "send a copy to my email" button. The email HTML is shown only inside an iframe
// with sandbox="" (no scripts, no same-origin) — never through innerHTML.
@Component({
  selector: 'app-invitation-preview',
  standalone: true,
  imports: [CommonModule, TablerIconsModule, TranslateModule],
  templateUrl: './invitation-preview.component.html',
  styleUrl: './invitation-preview.component.scss'
})
export class InvitationPreviewComponent {
  readonly store = inject(InvitationEditorStore);
  private readonly sanitizer = inject(DomSanitizer);

  /** Hides the test-copy button (no DemoAccounts.Manage). */
  @Input() canSendTest = true;
  @Input() disabled = false;

  readonly tabs: DemoChannel[] = ['Email', 'WhatsApp', 'Sms'];
  readonly channelIcons = DEMO_CHANNEL_ICONS;

  /** null = follow the chosen channel. */
  private pickedTab: DemoChannel | null = null;
  private lastChannel: DemoChannel | null = null;
  private htmlCache: { html: string; safe: SafeHtml } | null = null;

  get tab(): DemoChannel {
    // A channel change in the form brings the matching tab forward.
    if (this.lastChannel !== this.store.channel) {
      this.lastChannel = this.store.channel;
      this.pickedTab = null;
    }
    return this.pickedTab ?? this.store.channel;
  }

  pick(tab: DemoChannel): void {
    this.pickedTab = tab;
  }

  /**
   * The srcdoc for the sandboxed iframe. Trusted here only because sandbox="" keeps it
   * from running scripts or reaching this page. Cached so the frame is not reloaded on
   * every change detection.
   */
  get emailHtml(): SafeHtml | null {
    const html = this.store.preview?.email?.html;
    if (!html) return null;
    if (this.htmlCache?.html !== html) {
      this.htmlCache = { html, safe: this.sanitizer.bypassSecurityTrustHtml(html) };
    }
    return this.htmlCache.safe;
  }
}
