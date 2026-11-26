import { Directive, ElementRef, Input, NgZone, OnChanges, OnDestroy, inject } from '@angular/core';

const DURATION_MS = 600;

/**
 * Count-up for KPI numbers: renders `format(n)` while n eases from 0 to `value`,
 * once — the first time a real value arrives, and only when the number scrolls into view
 * (until then it shows `format(0)`, inside a section that is still hidden by the reveal). Later changes (a new period, a language
 * switch) write the final text straight away, so the animation never replays on every
 * refresh. The last frame always writes `format(value)` itself, so the shown precision
 * and currency/percent formatting are exactly the formatter's, never an interpolated
 * approximation. Reduced-motion users get the final value immediately.
 *
 * Usage: <span [d3CountUp]="card.raw" [d3CountUpFormat]="card.format"></span>
 * When `value` is null (unavailable metric) `fallback` text is shown instead.
 */
@Directive({
  selector: '[d3CountUp]',
  standalone: true,
})
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input('d3CountUp') value: number | null = null;
  @Input('d3CountUpFormat') format: (n: number) => string = (n) => String(n);
  @Input('d3CountUpFallback') fallback = '';

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private frame: number | null = null;
  private observer: IntersectionObserver | null = null;
  private played = false;

  ngOnChanges(): void {
    this.cancel();
    const value = this.value;
    if (value == null || !Number.isFinite(value)) {
      this.write(this.fallback);
      return;
    }
    if (this.played || value === 0 || this.prefersReducedMotion()) {
      this.played = true;
      this.write(this.format(value));
      return;
    }
    this.played = true;
    this.whenVisible(() => this.animate(value));
  }

  /** Runs `start` the first time the element is on screen (immediately without IO support). */
  private whenVisible(start: () => void): void {
    if (typeof IntersectionObserver === 'undefined') {
      start();
      return;
    }
    this.write(this.format(0));
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        this.observer?.disconnect();
        this.observer = null;
        start();
      }, { threshold: 0.6 });
      this.observer.observe(this.el.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.cancel();
  }

  private animate(target: number): void {
    const decimals = this.decimalsOf(target);
    const start = performance.now();
    this.zone.runOutsideAngular(() => {
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / DURATION_MS);
        if (t >= 1) {
          this.frame = null;
          this.write(this.format(target));
          return;
        }
        const eased = 1 - Math.pow(1 - t, 3);
        const factor = Math.pow(10, decimals);
        this.write(this.format(Math.round(target * eased * factor) / factor));
        this.frame = requestAnimationFrame(step);
      };
      this.frame = requestAnimationFrame(step);
    });
  }

  private decimalsOf(n: number): number {
    const s = String(n);
    const dot = s.indexOf('.');
    return dot < 0 ? 0 : Math.min(2, s.length - dot - 1);
  }

  private write(text: string): void {
    this.el.nativeElement.textContent = text;
  }

  private cancel(): void {
    if (this.frame != null) cancelAnimationFrame(this.frame);
    this.frame = null;
    // A new value while still waiting to be seen: it is written directly instead.
    this.observer?.disconnect();
    this.observer = null;
  }

  private prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
}
