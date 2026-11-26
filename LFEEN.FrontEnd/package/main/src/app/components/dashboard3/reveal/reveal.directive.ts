import { Directive } from '@angular/core';

/**
 * Marks a dashboard section for the page entrance: a single 320ms fade + 6px rise when
 * the page opens, sections staggered 60ms apart (styles in assets/scss/d3/_dashboard.scss).
 * It used to wait for each section to scroll into view; that made the lower half of the
 * page look empty and then "pop", so the entrance now plays once, on load, for all of it.
 * Off under prefers-reduced-motion (CSS).
 */
@Directive({
  selector: '[d3Reveal]',
  standalone: true,
  host: { class: 'd3-reveal' },
})
export class RevealDirective {}
