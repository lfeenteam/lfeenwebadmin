import { Injectable, signal } from '@angular/core';

// Lets a routed page intercept the shared header's back button when it manages
// its own internal "sub-view" state instead of real child routes (e.g. build-review's
// list/images/terms/license toggle). Without this, the header falls back to
// window.history.back(), which skips the internal state and jumps to the previous route.
@Injectable({
  providedIn: 'root'
})
export class PageBackOverrideService {
  private handler = signal<(() => boolean) | null>(null);

  set(fn: () => boolean): void {
    this.handler.set(fn);
  }

  clear(fn: () => boolean): void {
    if (this.handler() === fn) this.handler.set(null);
  }

  // Returns true if a registered handler consumed the back action.
  consume(): boolean {
    const fn = this.handler();
    return fn ? fn() : false;
  }
}
