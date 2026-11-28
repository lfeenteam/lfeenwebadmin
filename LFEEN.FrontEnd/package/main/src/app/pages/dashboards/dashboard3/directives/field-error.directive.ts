import { Directive, ElementRef, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { MatSelect } from '@angular/material/select';

/**
 * Ties a hand-rolled inline error message to its field for screen readers, the way
 * mat-form-field/mat-error does on its own (BUG-2702):
 *  - aria-invalid="true" on the field while it has an error;
 *  - the message's id appended to aria-describedby (ids already there are kept).
 *
 * Usage — the message element must carry the same id and render under the same condition:
 *   <input formControlName="name" [appFieldError]="fieldError('name')" fieldErrorId="x-name-err" />
 *   @if (fieldError('name'); as msg) { <small id="x-name-err">{{ msg }}</small> }
 *
 * On a mat-select the error state goes through its errorStateMatcher, so its own
 * aria-invalid binding agrees instead of overwriting ours.
 */
@Directive({
  selector: '[appFieldError]',
  standalone: true,
})
export class FieldErrorDirective implements OnChanges, OnDestroy {
  /** The field's current error: any truthy value (usually the message) means invalid. */
  @Input('appFieldError') error: unknown;
  /** id of the element that shows the error message. */
  @Input({ required: true }) fieldErrorId!: string;

  private el: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;
  private select = inject(MatSelect, { self: true, optional: true });
  private linkedId: string | null = null;

  constructor() {
    if (this.select) {
      this.select.errorStateMatcher = { isErrorState: () => !!this.error };
    }
  }

  ngOnChanges(): void {
    const invalid = !!this.error;
    if (!this.select) {
      if (invalid) this.el.setAttribute('aria-invalid', 'true');
      else this.el.removeAttribute('aria-invalid');
    }
    this.unlink();
    if (invalid && this.fieldErrorId) this.link(this.fieldErrorId);
  }

  ngOnDestroy(): void {
    this.unlink();
  }

  private link(id: string): void {
    const ids = this.describedBy();
    if (!ids.includes(id)) ids.push(id);
    this.writeDescribedBy(ids);
    this.linkedId = id;
  }

  private unlink(): void {
    if (!this.linkedId) return;
    const id = this.linkedId;
    this.linkedId = null;
    this.writeDescribedBy(this.describedBy().filter(x => x !== id));
  }

  private describedBy(): string[] {
    return (this.el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  }

  private writeDescribedBy(ids: string[]): void {
    if (this.select) {
      this.select.setDescribedByIds(ids);
    } else if (ids.length) {
      this.el.setAttribute('aria-describedby', ids.join(' '));
    } else {
      this.el.removeAttribute('aria-describedby');
    }
  }
}
