import { EventEmitter, Injectable, OnDestroy, effect, inject } from '@angular/core';
import { Direction } from '@angular/cdk/bidi';
import { CoreService } from './core.service';

/**
 * App-wide replacement for the CDK's root `Directionality` (BUG-2511).
 *
 * The CDK's own root service reads `dir` from <body>/<html> once, when it is first
 * created, and never updates it. `Overlay.create()` falls back to that value for every
 * overlay opened without an explicit `direction` (MatDialog, bottom sheets, snackbars,
 * datepickers…), so after switching language without a reload every dialog kept the
 * language the app was opened in. This one derives the direction from the current
 * language on every read, and emits `change` when it flips.
 *
 * It is a standalone class rather than a subclass: the base class declares `value` as a
 * field and assigns it in its constructor, which would shadow or break a getter.
 */
@Injectable()
export class AppDirectionality implements OnDestroy {
  private readonly settings = inject(CoreService);
  private last: Direction = this.value;

  readonly change = new EventEmitter<Direction>();

  get value(): Direction {
    // Derived from the language alone, like the <html dir> sync in AppComponent.
    return this.settings.getOptionsSignal()().language === 'ar' ? 'rtl' : 'ltr';
  }

  private readonly emitOnChange = effect(() => {
    const dir = this.value;
    if (dir !== this.last) {
      this.last = dir;
      this.change.emit(dir);
    }
  });

  ngOnDestroy(): void {
    this.emitOnChange.destroy();
    this.change.complete();
  }
}
