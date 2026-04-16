import { defaultLocale, enabledLocales, type Locale } from './config';

/** Cookie the middleware reads; client updates this when the user changes language. */
export const LOCALE_COOKIE_NAME = 'locale';

/** Request header set by middleware for Server Components (no extra round-trip). */
export const MIDDLEWARE_LOCALE_HEADER = 'x-middleware-locale';

function effectiveDefault(): Locale {
  if (enabledLocales.includes(defaultLocale)) return defaultLocale;
  return enabledLocales[0]!;
}

function parseAcceptLanguagePrimaryTags(acceptLanguage: string | null): string[] {
  if (!acceptLanguage) return [];
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const rawPart of acceptLanguage.split(',')) {
    const primaryTag = rawPart.split(';')[0]?.trim().toLowerCase();
    if (!primaryTag) continue;
    const base = primaryTag.split('-')[0] ?? primaryTag;
    if (!base || seen.has(base)) continue;
    seen.add(base);
    tags.push(base);
  }
  return tags;
}

function matchEnabledLocale(tag: string): Locale | null {
  for (const loc of enabledLocales) {
    if (tag === loc) return loc;
    if (tag.startsWith(`${loc}-`)) return loc;
  }
  return null;
}

/**
 * Pick UI locale for middleware: cookie wins, else first Accept-Language match among
 * enabledLocales, else default (or first enabled locale if default is disabled).
 */
export function pickLocaleForMiddleware(
  cookieRaw: string | undefined,
  acceptLanguage: string | null
): Locale {
  if (cookieRaw && enabledLocales.includes(cookieRaw as Locale)) {
    return cookieRaw as Locale;
  }

  for (const tag of parseAcceptLanguagePrimaryTags(acceptLanguage)) {
    const matched = matchEnabledLocale(tag);
    if (matched) return matched;
  }

  return effectiveDefault();
}

export function pickLocaleFromMiddlewareHeader(headerValue: string | null): Locale {
  if (headerValue && enabledLocales.includes(headerValue as Locale)) {
    return headerValue as Locale;
  }
  return effectiveDefault();
}
