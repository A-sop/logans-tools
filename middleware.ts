import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  LOCALE_COOKIE_NAME,
  MIDDLEWARE_LOCALE_HEADER,
  pickLocaleForMiddleware,
} from './src/lib/i18n/locale-request';

const PREVIEW_COOKIE_NAME = 'gabc_preview';
const ACCESS_PATH = '/gabc-access';
const DEFAULT_AFTER_ACCESS = '/gabc';

function isGabcPreviewHost(host: string | null | undefined) {
  if (!host) return false;
  return host.toLowerCase().startsWith('gabc.');
}

export function middleware(request: NextRequest) {
  // Lightweight preview gate for board-approval deployments.
  // Enabled on host `gabc.*` or when explicitly enabled for local testing.
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.host;
  const hostname = request.nextUrl.hostname;
  const previewGateEnabled =
    process.env.GABC_PREVIEW_GATE_ENABLED === 'true' ||
    isGabcPreviewHost(host) ||
    hostname.toLowerCase() === 'gabc.logans.tools';
  if (previewGateEnabled) {
    const { pathname, search } = request.nextUrl;

    const isAccessPage = pathname === ACCESS_PATH;
    const isAllowedPublicAsset =
      pathname.startsWith('/_next/') ||
      pathname === '/favicon.ico' ||
      pathname === '/robots.txt' ||
      pathname === '/sitemap.xml';

    if (!isAccessPage && !isAllowedPublicAsset) {
      const hasPreviewCookie = request.cookies.get(PREVIEW_COOKIE_NAME)?.value === '1';
      if (!hasPreviewCookie) {
        const url = request.nextUrl.clone();
        url.pathname = ACCESS_PATH;
        const next = pathname === '/' ? DEFAULT_AFTER_ACCESS : `${pathname}${search ?? ''}`;
        url.searchParams.set('next', next);
        const res = NextResponse.redirect(url);
        res.headers.set('x-gabc-preview-mw', '1');
        return res;
      }
    }

    // When accessing the subdomain root, treat it as the board hub entry.
    if (pathname === '/' && request.cookies.get(PREVIEW_COOKIE_NAME)?.value === '1') {
      const url = request.nextUrl.clone();
      url.pathname = DEFAULT_AFTER_ACCESS;
      url.search = '';
      const res = NextResponse.redirect(url);
      res.headers.set('x-gabc-preview-mw', '1');
      return res;
    }
  }

  const cookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const chosen = pickLocaleForMiddleware(cookie, request.headers.get('accept-language'));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(MIDDLEWARE_LOCALE_HEADER, chosen);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (previewGateEnabled) response.headers.set('x-gabc-preview-mw', '1');

  if (cookie !== chosen) {
    response.cookies.set(LOCALE_COOKIE_NAME, chosen, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
