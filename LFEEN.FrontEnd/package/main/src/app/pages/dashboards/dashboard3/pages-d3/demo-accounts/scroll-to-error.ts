import { Injector } from '@angular/core';
import { scrollToFirstError as scrollToFirstErrorIn } from 'src/app/utils/scroll-to-error.util';

/** The page alert and the field messages, in DOM order. */
export const DEMO_ERROR_SELECTOR = '.da-alert.danger, .da-error';

/** Demo-accounts flavour of the shared helper: defaults to the demo pages' error selector. */
export function scrollToFirstError(host: HTMLElement, injector: Injector, selector = DEMO_ERROR_SELECTOR): void {
  scrollToFirstErrorIn(host, injector, selector);
}
