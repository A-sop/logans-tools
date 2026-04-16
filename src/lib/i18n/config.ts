export const allLocales = ['en', 'de'] as const;
export type Locale = (typeof allLocales)[number];

export const defaultLocale: Locale = 'en';

/**
 * Locales that are currently “live” in the app.
 * You can set this to ['en'] to ship English-only while keeping translations ready.
 */
export const enabledLocales: Locale[] = ['en', 'de'];

/**
 * Controls whether the language toggle is visible in the UI.
 * Useful if you want i18n-ready content without exposing a switcher yet.
 */
export const showLanguageToggle = true;

