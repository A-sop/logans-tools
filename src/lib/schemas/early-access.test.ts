import { describe, it, expect } from 'vitest';
import { earlyAccessSchema, parseEarlyAccessFormData } from './early-access';

describe('earlyAccessSchema', () => {
  it('accepts valid email and locale', () => {
    const result = earlyAccessSchema.safeParse({
      email: '  test@example.com  ',
      locale: 'en',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@example.com');
      expect(result.data.locale).toBe('en');
    }
  });

  it('rejects empty email', () => {
    const result = earlyAccessSchema.safeParse({ email: '', locale: 'en' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = earlyAccessSchema.safeParse({
      email: 'invalid',
      locale: 'en',
    });
    expect(result.success).toBe(false);
  });

  it('rejects email over 254 chars', () => {
    const long = 'a'.repeat(250) + '@b.co';
    const result = earlyAccessSchema.safeParse({ email: long, locale: 'en' });
    expect(result.success).toBe(false);
  });

  it('accepts de locale', () => {
    const result = earlyAccessSchema.safeParse({
      email: 'test@example.com',
      locale: 'de',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid locale', () => {
    const result = earlyAccessSchema.safeParse({
      email: 'test@example.com',
      locale: 'fr',
    });
    expect(result.success).toBe(false);
  });
});

describe('parseEarlyAccessFormData', () => {
  it('returns success for valid form data', () => {
    const fd = new FormData();
    fd.set('email', 'test@example.com');
    fd.set('locale', 'en');
    const result = parseEarlyAccessFormData(fd);
    expect(result.success).toBe(true);
  });

  it('returns error key for invalid email', () => {
    const fd = new FormData();
    fd.set('email', 'bad');
    fd.set('locale', 'en');
    const result = parseEarlyAccessFormData(fd);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorKey).toBe('email_invalid');
    }
  });
});
