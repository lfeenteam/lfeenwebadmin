import { Injector, afterNextRender } from '@angular/core';

/** The page alert and the field messages, in DOM order. */
export const DEMO_ERROR_SELECTOR = '.da-alert.danger, .da-error';

/**
 * Brings the first visible error inside `host` to the middle of its scroll container, once
 * the error has rendered. On narrow screens the submit button sits in the sticky footer while
 * the page error is at the top, so without this the click looks like it did nothing.
 *
 * Only the vertical axis of the one container that scrolls is moved: `scrollIntoView` also
 * adjusts the horizontal axis of every ancestor, and on phones in LTR that extra smooth
 * scroll cancels the vertical one, so the page never moved (BUG-2274).
 */
export function scrollToFirstError(host: HTMLElement, injector: Injector, selector = DEMO_ERROR_SELECTOR): void {
  afterNextRender(() => {
    const el = Array.from(host.querySelectorAll<HTMLElement>(selector))
      .find(e => e.getClientRects().length > 0); // skip messages inside collapsed sections
    if (el) scrollToCenter(el);
  }, { injector });
}

function scrollToCenter(el: HTMLElement): void {
  const container = scrollParent(el);
  const isRoot = container === document.scrollingElement || container === document.documentElement || container === document.body;
  const viewTop = isRoot ? 0 : container.getBoundingClientRect().top;
  const viewHeight = isRoot ? window.innerHeight : container.clientHeight;
  const rect = el.getBoundingClientRect();
  const top = container.scrollTop + (rect.top - viewTop) - Math.max(0, (viewHeight - rect.height) / 2);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  container.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });
}

/** The nearest ancestor that scrolls vertically (the layout's content wrapper), else the page. */
function scrollParent(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const overflowY = getComputedStyle(p).overflowY;
    if (/(auto|scroll|overlay)/.test(overflowY) && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}
