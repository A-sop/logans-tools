import { translations, type Locale, defaultLocale, supportedLocales } from './translations';

const STORAGE_KEY = 'locale';

export { translations, defaultLocale, supportedLocales };
export type { Locale };

/** Get a translation; supports dot notation for nested keys (e.g. "validation.email_required"). */
export function t(locale: Locale, key: string, params?: Record<string, string>): string {
  const dict = translations[locale] ?? translations.en;
  const parts = key.split('.');
  let value: unknown = dict;
  for (const part of parts) {
    value = (value as Record<string, unknown>)?.[part];
  }
  let str = typeof value === 'string' ? value : key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(`{${k}}`, v);
    }
  }
  return str;
}

/** Get stored locale from localStorage (client only). */
export function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && supportedLocales.includes(stored as Locale) ? (stored as Locale) : null;
}

/** Store locale in localStorage (client only). */
export function setStoredLocale(locale: Locale): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale);
  }
}
