import { Component, Input, OnChanges } from '@angular/core';
import { InvitationVariable } from '../../../../interfaces/demo-account.model';

const TOKEN_PATTERN = /\{\{\s*([^{}\s]+)\s*\}\}/g;

interface Part {
  text: string;
  /** Set when the part is a known variable. */
  variable?: InvitationVariable;
  token?: string;
}

/**
 * Read-only invitation text: known {{tokens}} show as the same chips as the editor
 * (label in the panel's language, sign-in ones in purple); everything else as typed.
 */
@Component({
  selector: 'app-invitation-text',
  standalone: true,
  template: `@for (p of parts; track $index) {@if (p.variable) {<span class="it-chip" [class.it-chip--cred]="p.variable.isCredential" [title]="p.token">{{ english ? p.variable.labelEn : p.variable.labelAr }}</span>} @else {{{ p.text }}}}`,
  styles: [`
    :host { white-space: pre-wrap; overflow-wrap: anywhere; }
    .it-chip {
      display: inline-block; margin: 0 2px; padding: 0 8px; border-radius: 999px;
      background: #e0ecff; color: #1d4ed8; font-size: 12px; font-weight: 700; line-height: 22px;
      white-space: nowrap; vertical-align: baseline;
    }
    .it-chip--cred { background: #f1e8ff; color: #7c3aed; }
  `]
})
export class InvitationTextComponent implements OnChanges {
  @Input() text: string | null = '';
  @Input() variables: InvitationVariable[] = [];
  @Input() english = false;

  parts: Part[] = [];

  ngOnChanges(): void {
    const text = this.text ?? '';
    const parts: Part[] = [];
    let last = 0;
    for (const m of text.matchAll(TOKEN_PATTERN)) {
      const id = m[1].toLowerCase();
      const v = this.variables.find(x => String(x.number) === id || x.key.toLowerCase() === id);
      if (!v) continue; // unknown → shown as typed
      const start = m.index ?? 0;
      if (start > last) parts.push({ text: text.slice(last, start) });
      parts.push({ text: m[0], variable: v, token: m[0] });
      last = start + m[0].length;
    }
    if (last < text.length) parts.push({ text: text.slice(last) });
    this.parts = parts;
  }
}
