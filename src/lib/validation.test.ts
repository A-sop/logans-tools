import { describe, it, expect } from 'vitest';
import { validateEmail } from './validation';

describe('validateEmail', () => {
  it('returns valid for correct email', () => {
    expect(validateEmail('user@example.com')).toEqual({ valid: true });
    expect(validateEmail('a@b.co')).toEqual({ valid: true });
  });

  it('returns errorKey for empty string', () => {
    expect(validateEmail('')).toEqual({ valid: false, errorKey: 'email_required' });
    expect(validateEmail('   ')).toEqual({ valid: false, errorKey: 'email_required' });
  });

  it('returns errorKey for invalid format', () => {
    expect(validateEmail('notanemail')).toEqual({
      valid: false,
      errorKey: 'email_invalid',
    });
    expect(validateEmail('missing@domain')).toEqual({
      valid: false,
      errorKey: 'email_invalid',
    });
  });

  it('trims whitespace and validates', () => {
    expect(validateEmail('  user@example.com  ')).toEqual({ valid: true });
  });

  it('accepts emails with numbers in local part', () => {
    expect(validateEmail('you2ex@ampl.com')).toEqual({ valid: true });
    expect(validateEmail('user123@company.co.uk')).toEqual({ valid: true });
  });
});
