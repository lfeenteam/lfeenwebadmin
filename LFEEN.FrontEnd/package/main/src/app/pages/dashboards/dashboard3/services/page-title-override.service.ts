import { Injectable, signal } from '@angular/core';

// Lets a routed page override the shared header's static, translated title with the
// actual entity name it is reviewing (e.g. the unit/building/account name) once that
// data has loaded. dashboard3.component clears this on every route change, so the
// header falls back to the route's static titleKey until the new page sets its own.
@Injectable({
  providedIn: 'root'
})
export class PageTitleOverrideService {
  private readonly _title = signal<string | null>(null);
  readonly title = this._title.asReadonly();

  set(title: string | null | undefined): void {
    this._title.set(title?.trim() || null);
  }

  clear(): void {
    this._title.set(null);
  }
}
