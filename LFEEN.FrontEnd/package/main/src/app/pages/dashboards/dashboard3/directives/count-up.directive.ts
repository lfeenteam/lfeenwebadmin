import { Directive, ElementRef, Input, OnChanges, OnDestroy, inject } from '@angular/core';

/**
 * Animates a number from its previous value to the new one (ease-out, ~700ms).
 * Non-numeric values (e.g. '—' on a load error) are written as-is.
 * Respects prefers-reduced-motion.
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input('appCountUp') value: number | string | null = 0;
  @Input() countUpSuffix = '';

  private el = inject(ElementRef<HTMLElement>);
  private current = 0;
  private frame = 0;

  ngOnChanges(): void {
    cancelAnimationFrame(this.frame);
    const target = this.value;

    if (typeof target !== 'number' || !isFinite(target)) {
      this.el.nativeElement.textContent = target == null ? '' : String(target);
      return;
    }

    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = this.current;
    if (reduce || from === target) {
      this.write(target);
      return;
    }

    const duration = 700;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.write(Math.round(from + (target - from) * eased));
      if (t < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private write(n: number): void {
    this.current = n;
    this.el.nativeElement.textContent = n + this.countUpSuffix;
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
  }
}
