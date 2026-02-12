/**
 * Pure validation helpers for form/server actions.
 */

export type ValidationErrorKey = 'email_required' | 'email_invalid';

export type ValidationResult = { valid: true } | { valid: false; errorKey: ValidationErrorKey };

/** Validates email format. Returns valid or error key for i18n. */
export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { valid: false, errorKey: 'email_required' };
  }
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(trimmed)) {
    return { valid: false, errorKey: 'email_invalid' };
  }
  return { valid: true };
}
