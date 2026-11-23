import { ValidatorFn } from '@angular/forms';

const isEmpty = (v: unknown) => v === null || v === undefined || v === '';

/** Rejects fractions such as 1.5 for fields the API binds as int. */
export const wholeNumberValidator: ValidatorFn = (c) =>
  isEmpty(c.value) || Number.isInteger(Number(c.value)) ? null : { wholeNumber: true };

/** Like Validators.max, but returns `{ maxValue: { max } }` to match the forms' error keys. */
export function maxValueValidator(max: number): ValidatorFn {
  return (c) => (isEmpty(c.value) || !(Number(c.value) > max) ? null : { maxValue: { max } });
}
