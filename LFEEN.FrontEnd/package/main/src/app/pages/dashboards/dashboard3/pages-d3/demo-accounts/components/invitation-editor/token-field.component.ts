import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild
} from '@angular/core';
import { InvitationIssue, InvitationVariable } from '../../../../interfaces/demo-account.model';

const TOKEN_PATTERN = /\{\{\s*([^{}\s]+)\s*\}\}/g;
/** Ctrl/Cmd + these would add bold/italic/underline markup to the field. */
const FORMAT_KEYS = new Set(['b', 'i', 'u']);

/**
 * A text field where every known variable is one locked chip that shows its label
 * (Arabic or English) — it can't be typed into, and Backspace removes it whole.
 * The value in and out is plain text with {{key}} tokens, exactly what the server takes.
 *
 * Built on contenteditable. The DOM is rebuilt from the value whenever the value is set
 * from outside, a typed/pasted token should become a chip, or the issue marks change;
 * the caret is kept by its position in the plain text, so typing is never interrupted.
 */
@Component({
  selector: 'app-token-field',
  standalone: true,
  template: `
    <div #box class="tf" [class.tf--multi]="multiline" [class.tf--empty]="!value" [class.invalid]="invalid"
         [class.disabled]="disabled" [attr.contenteditable]="disabled ? 'false' : 'true'"
         role="textbox" [attr.aria-multiline]="multiline" [attr.aria-label]="ariaLabel" [attr.id]="fieldId"
         [attr.data-placeholder]="placeholder" dir="auto" spellcheck="false"
         (input)="onInput()" (keydown)="onKeydown($event)" (paste)="onPaste($event)" (drop)="$event.preventDefault()"
         (focus)="focused.emit()" (compositionstart)="composing = true" (compositionend)="composing = false; onInput()"></div>
  `,
  styleUrl: './token-field.component.scss'
})
export class TokenFieldComponent implements OnChanges, AfterViewInit {
  @Input() value = '';
  @Input() multiline = false;
  @Input() placeholder = '';
  @Input() disabled = false;
  @Input() invalid = false;
  @Input() fieldId?: string;
  @Input() ariaLabel?: string;
  /** The editor's variables: tokens that name one of them become chips. */
  @Input() variables: InvitationVariable[] = [];
  /** Chip labels in English (else Arabic). */
  @Input() english = false;
  /** Ranges to underline (this field's issues from the preview). */
  @Input() issues: InvitationIssue[] = [];

  @Output() valueChange = new EventEmitter<string>();
  @Output() focused = new EventEmitter<void>();

  @ViewChild('box', { static: true }) private box!: ElementRef<HTMLDivElement>;

  composing = false;
  private renderedKey: string | null = null;

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(): void {
    if (this.box) this.render();
  }

  // ── Public ────────────────────────────────────────────────

  /** Focuses the field with the caret at the end (the label click). */
  focus(): void {
    if (this.disabled) return;
    this.box.nativeElement.focus();
    this.setCaret(this.value.length);
  }

  // Insert at the caret (variable chips, used by the editor).

  insert(text: string): void {
    if (this.disabled) return;
    const sel = this.selectionOffsets() ?? { start: this.value.length, end: this.value.length };
    this.commit(this.value.slice(0, sel.start) + text + this.value.slice(sel.end), sel.start + text.length);
  }

  // ── Events ────────────────────────────────────────────────

  onInput(): void {
    if (this.composing) return; // Arabic/IME input: wait for the composed text
    const v = this.serialize(this.box.nativeElement);
    this.value = v;
    this.valueChange.emit(v);
    // A token typed by hand, or markup the browser added → rebuild into chips/plain text.
    if (this.needsRebuild()) this.render(true);
    else this.renderedKey = this.keyFor(v);
  }

  onKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && FORMAT_KEYS.has(e.key.toLowerCase())) {
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (this.multiline) this.insert('\n'); // a plain newline, never a <div>
    }
  }

  onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    let text = e.clipboardData?.getData('text/plain') ?? '';
    if (!this.multiline) text = text.replace(/[\r\n]+/g, ' ');
    this.insert(text.replace(/\r\n?/g, '\n'));
  }

  // ── Rendering ─────────────────────────────────────────────

  private keyFor(value: string): string {
    const ranges = this.issues.map(i => `${i.start}-${i.end}`).join(',');
    return `${value}|${ranges}|${this.english}|${this.variables.length}`;
  }

  /** Rebuilds the DOM from the value; keeps the caret when the field has focus. */
  private render(force = false): void {
    const key = this.keyFor(this.value);
    if (!force && (key === this.renderedKey || this.composing)) return;
    const el = this.box.nativeElement;
    const caret = document.activeElement === el ? this.selectionOffsets()?.end ?? null : null;
    el.replaceChildren(...this.build(this.value));
    this.renderedKey = key;
    if (caret != null) this.setCaret(caret);
  }

  private build(value: string): Node[] {
    const nodes: Node[] = [];
    const issueAt = (from: number, to: number) => this.issues.some(i => i.start < to && i.end > from);

    const pushText = (from: number, to: number) => {
      // Split plain text at issue edges so only the bad part is marked.
      const cuts = new Set([from, to]);
      for (const i of this.issues) {
        if (i.start > from && i.start < to) cuts.add(i.start);
        if (i.end > from && i.end < to) cuts.add(i.end);
      }
      const points = [...cuts].sort((a, b) => a - b);
      for (let k = 0; k < points.length - 1; k++) {
        const [a, b] = [points[k], points[k + 1]];
        const text = document.createTextNode(value.slice(a, b));
        if (issueAt(a, b)) {
          const mark = document.createElement('mark');
          mark.className = 'tf-issue';
          mark.appendChild(text);
          nodes.push(mark);
        } else {
          nodes.push(text);
        }
      }
    };

    let last = 0;
    for (const m of value.matchAll(TOKEN_PATTERN)) {
      const v = this.variableFor(m[1]);
      if (!v) continue; // unknown → stays text, the preview marks it
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (start > last) pushText(last, start);
      nodes.push(this.chip(v, m[0], issueAt(start, end)));
      last = end;
    }
    if (last < value.length) pushText(last, value.length);
    // Lets a trailing newline show (and hold the caret).
    if (value.endsWith('\n')) {
      const br = document.createElement('br');
      br.className = 'tf-end';
      nodes.push(br);
    }
    return nodes;
  }

  private chip(v: InvitationVariable, token: string, issue: boolean): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'tf-chip' + (v.isCredential ? ' tf-chip--cred' : '') + (issue ? ' tf-chip--issue' : '');
    chip.contentEditable = 'false';
    chip.dataset['token'] = token;
    chip.title = token;
    chip.textContent = this.english ? v.labelEn : v.labelAr;
    return chip;
  }

  private variableFor(ident: string): InvitationVariable | undefined {
    const id = ident.toLowerCase();
    return this.variables.find(v => String(v.number) === id || v.key.toLowerCase() === id);
  }

  /** Rebuild when a known token sits in plain text or the browser added its own elements. */
  private needsRebuild(): boolean {
    const el = this.box.nativeElement;
    const chips = el.querySelectorAll('.tf-chip').length;
    const tokens = [...this.value.matchAll(TOKEN_PATTERN)].filter(m => this.variableFor(m[1])).length;
    if (chips !== tokens) return true;
    return Array.from(el.querySelectorAll('*')).some(n =>
      !(n.classList.contains('tf-chip') || n.tagName === 'MARK' || n.tagName === 'BR'));
  }

  // ── Plain text ⇄ DOM ──────────────────────────────────────

  /** The plain-text value of a node tree: chips → their token, <br> → newline. */
  private serialize(root: Node): string {
    let out = '';
    root.childNodes.forEach(n => {
      if (n.nodeType === Node.TEXT_NODE) {
        out += (n.textContent ?? '').replace(/​/g, '');
      } else if (n instanceof HTMLElement) {
        if (n.classList.contains('tf-chip')) out += n.dataset['token'] ?? '';
        else if (n.tagName === 'BR') out += n.classList.contains('tf-end') ? '' : '\n';
        else if (n.tagName === 'DIV' || n.tagName === 'P') {
          // A block the browser created on its own: it starts a new line.
          if (out && !out.endsWith('\n')) out += '\n';
          out += this.serialize(n);
        } else {
          out += this.serialize(n);
        }
      }
    });
    // An emptied field may keep a lone <br>.
    if (root === this.box?.nativeElement && out === '\n' && root.childNodes.length === 1) return '';
    return out;
  }

  /** Where the selection starts/ends, as positions in the plain text. */
  private selectionOffsets(): { start: number; end: number } | null {
    const el = this.box.nativeElement;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null;
    return { start: this.offsetOf(range.startContainer, range.startOffset), end: this.offsetOf(range.endContainer, range.endOffset) };
  }

  private offsetOf(node: Node, offset: number): number {
    const r = document.createRange();
    r.setStart(this.box.nativeElement, 0);
    r.setEnd(node, offset);
    const holder = document.createElement('div');
    holder.appendChild(r.cloneContents());
    return this.serialize(holder).length;
  }

  /** Puts the caret at a plain-text position (never inside a chip). */
  private setCaret(offset: number): void {
    const el = this.box.nativeElement;
    const sel = window.getSelection();
    if (!sel) return;
    const range = document.createRange();
    let left = offset;
    let placed = false;

    const walk = (parent: Node): void => {
      for (const n of Array.from(parent.childNodes)) {
        if (placed) return;
        if (n.nodeType === Node.TEXT_NODE) {
          const len = n.textContent?.length ?? 0;
          if (left <= len) { range.setStart(n, left); placed = true; return; }
          left -= len;
        } else if (n instanceof HTMLElement) {
          if (n.classList.contains('tf-chip')) {
            const len = (n.dataset['token'] ?? '').length;
            if (left <= 0) { range.setStartBefore(n); placed = true; return; }
            if (left <= len) { range.setStartAfter(n); placed = true; return; }
            left -= len;
          } else if (n.tagName === 'BR') {
            if (n.classList.contains('tf-end')) continue;
            if (left <= 0) { range.setStartBefore(n); placed = true; return; }
            left -= 1;
            if (left === 0) { range.setStartAfter(n); placed = true; return; }
          } else {
            walk(n);
          }
        }
      }
    };
    walk(el);
    if (!placed) { range.selectNodeContents(el); range.collapse(false); }
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  private commit(value: string, caret: number): void {
    this.value = value;
    this.valueChange.emit(value);
    const el = this.box.nativeElement;
    el.focus();
    el.replaceChildren(...this.build(value));
    this.renderedKey = this.keyFor(value);
    this.setCaret(caret);
  }
}
