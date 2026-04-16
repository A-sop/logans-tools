import { allLocales, defaultLocale, enabledLocales, showLanguageToggle, type Locale } from './config';
import {
  LOCALE_COOKIE_NAME,
  MIDDLEWARE_LOCALE_HEADER,
  pickLocaleForMiddleware,
  pickLocaleFromMiddlewareHeader,
} from './locale-request';
import { translations } from './translations';

const STORAGE_KEY = 'locale';

export {
  translations,
  allLocales,
  defaultLocale,
  enabledLocales,
  showLanguageToggle,
  LOCALE_COOKIE_NAME,
  MIDDLEWARE_LOCALE_HEADER,
  pickLocaleForMiddleware,
  pickLocaleFromMiddlewareHeader,
};
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
  return stored && enabledLocales.includes(stored as Locale) ? (stored as Locale) : null;
}

/** Store locale in localStorage (client only). */
export function setStoredLocale(locale: Locale): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, locale);
  }
}

/** Persist locale for both client (localStorage) and server/middleware (cookie). */
export function persistLocalePreference(locale: Locale): void {
  setStoredLocale(locale);
  if (typeof document !== 'undefined') {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
}
