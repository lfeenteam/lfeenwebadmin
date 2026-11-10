import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatMenuModule } from '@angular/material/menu';

/** #RRGGBB, or #AARRGGBB (alpha first) as the API also accepts. */
const HEX_PATTERN = /^#([0-9A-F]{6}|[0-9A-F]{8})$/;

/** The colour part without alpha, "#RRGGBB". */
function rgbPart(hex: string): string {
  return hex.length === 9 ? `#${hex.slice(3)}` : hex;
}

/** Brand-friendly starting points; anything else comes from the picker or the hex box. */
const PRESETS = [
  '#111110', '#153E36', '#0F7A3D', '#16A34A', '#2B7FFF', '#4F46E5',
  '#9333EA', '#DB2777', '#DC2626', '#EA580C', '#DDBE74', '#F8FAFC',
];

interface Hsv { h: number; s: number; v: number; }

function hexToHsv(hex: string): Hsv {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`.toUpperCase();
}

/**
 * Hex text box with a swatch beside it; the swatch opens a picker (saturation/brightness
 * area, hue slider, presets). The value is always "#RRGGBB" once valid; while the user is
 * mid-typing the raw text is passed through so the form's validators can flag it.
 */
@Component({
  selector: 'app-color-field',
  standalone: true,
  imports: [CommonModule, MatMenuModule],
  templateUrl: './color-field.component.html',
  styleUrl: './color-field.component.scss',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => ColorFieldComponent), multi: true }],
})
export class ColorFieldComponent implements ControlValueAccessor {
  @Input() invalid = false;
  @Input() ariaLabel = '';

  readonly presets = PRESETS;
  text = '';
  hsv: Hsv = { h: 0, s: 0, v: 0 };
  disabled = false;

  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  get isValid(): boolean {
    return HEX_PATTERN.test(this.text);
  }

  /** CSS colour of the current value — CSS puts alpha last (#RRGGBBAA). */
  get cssColor(): string | null {
    if (!this.isValid) return null;
    return this.text.length === 9 ? `#${this.text.slice(3)}${this.text.slice(1, 3)}` : this.text;
  }

  /** Pure hue at full saturation/brightness — the background of the picker area. */
  get hueColor(): string {
    return hsvToHex({ h: this.hsv.h, s: 1, v: 1 });
  }

  writeValue(value: string | null): void {
    this.text = (value ?? '').toUpperCase();
    if (this.isValid) this.hsv = hexToHsv(rgbPart(this.text));
  }

  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.disabled = disabled; }

  onTextInput(raw: string): void {
    let text = raw.trim().toUpperCase();
    if (text && !text.startsWith('#')) text = `#${text}`;
    this.text = text;
    if (this.isValid) this.hsv = hexToHsv(rgbPart(text));
    this.onChange(text);
  }

  pickPreset(hex: string): void {
    this.hsv = hexToHsv(hex);
    this.commit(hex);
  }

  setHue(h: number): void {
    this.hsv = { ...this.hsv, h };
    this.commit(hsvToHex(this.hsv));
  }

  // ── Saturation / brightness area (pointer drag) ─────────────

  onSvDown(event: PointerEvent): void {
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.updateSv(event);
  }

  onSvMove(event: PointerEvent): void {
    if (event.buttons & 1) this.updateSv(event);
  }

  /** Arrow keys nudge the thumb; stopped so the menu doesn't treat them as item navigation. */
  onSvKey(event: KeyboardEvent): void {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    event.stopPropagation();
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    this.hsv = { ...this.hsv, s: clamp(this.hsv.s + move[0]), v: clamp(this.hsv.v + move[1]) };
    this.commit(hsvToHex(this.hsv));
  }

  private updateSv(event: PointerEvent): void {
    // The handlers sit on the area itself, so currentTarget is always it (the thumb ignores pointers).
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const v = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    this.hsv = { ...this.hsv, s, v };
    this.commit(hsvToHex(this.hsv));
  }

  private commit(hex: string): void {
    this.text = hex;
    this.onChange(hex);
  }
}
