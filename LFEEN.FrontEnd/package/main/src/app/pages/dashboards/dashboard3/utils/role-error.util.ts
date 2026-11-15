import { FormGroup } from '@angular/forms';
import { extractApiFieldErrors } from './api-error.util';

export type RoleNameField = 'nameAr' | 'nameEn';

/**
 * Maps a duplicate-name rejection from POST/PUT /api/roles onto the matching name control,
 * so the message shows under the field instead of only in a toast.
 *
 * - `RoleArabicNameAlreadyExists` (or a field error on NameAr) → nameAr
 * - `RoleAlreadyExists` (or a field error on NameEn) → nameEn
 *
 * The payload copies one name into the other when only one was typed, so when the targeted
 * control is empty the error goes on the control the user actually filled.
 *
 * Returns the control the error was set on, or null when the error isn't a name clash.
 * Angular drops the `serverError` key on the control's next value change.
 */
export function applyRoleNameServerError(err: any, form: FormGroup): RoleNameField | null {
  const body = err?.error;
  const code: string = body?.errorCode ?? '';
  const fieldErrors = extractApiFieldErrors(err);

  let field: RoleNameField | null = null;
  let message: string | null = null;

  const arField = fieldErrors.find(e => e.field.endsWith('namear'));
  const enField = fieldErrors.find(e => e.field.endsWith('nameen'));

  if (code === 'RoleArabicNameAlreadyExists' || arField) {
    field = 'nameAr';
    message = arField?.message ?? null;
  } else if (code === 'RoleAlreadyExists' || enField) {
    field = 'nameEn';
    message = enField?.message ?? null;
  }
  if (!field) return null;

  message = message || body?.message || null;
  if (!message) return null;

  const other: RoleNameField = field === 'nameAr' ? 'nameEn' : 'nameAr';
  if (!String(form.get(field)?.value ?? '').trim() && String(form.get(other)?.value ?? '').trim()) {
    field = other;
  }

  const control = form.get(field)!;
  control.setErrors({ ...(control.errors ?? {}), serverError: message });
  control.markAsTouched();
  return field;
}
