import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Password complexity rules, mirroring the API's validation for auth/change-password
 * (400 VALIDATION_ERROR: at least 8 characters, uppercase, lowercase, number, special character).
 * Letters/digits are ASCII-only, as on the server, so anything else counts as a special character.
 */
export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRuleKey = 'minLength' | 'uppercase' | 'lowercase' | 'number' | 'special';

export const PASSWORD_RULES: ReadonlyArray<{ key: PasswordRuleKey; test: (value: string) => boolean }> = [
  { key: 'minLength', test: (v) => v.length >= PASSWORD_MIN_LENGTH },
  { key: 'uppercase', test: (v) => /[A-Z]/.test(v) },
  { key: 'lowercase', test: (v) => /[a-z]/.test(v) },
  { key: 'number', test: (v) => /[0-9]/.test(v) },
  { key: 'special', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

/** The rules `value` does not meet yet. */
export function unmetPasswordRules(value: string | null | undefined): PasswordRuleKey[] {
  const v = value ?? '';
  return PASSWORD_RULES.filter((rule) => !rule.test(v)).map((rule) => rule.key);
}

/**
 * Control validator: `{ passwordRules: ['uppercase', ...] }` listing every unmet rule.
 * An empty value is left to `Validators.required`.
 */
export const passwordComplexityValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value: string = control.value ?? '';
  if (!value) return null;
  const unmet = unmetPasswordRules(value);
  return unmet.length ? { passwordRules: unmet } : null;
};
