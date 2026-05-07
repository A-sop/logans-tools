import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  LOCALE_COOKIE_NAME,
  MIDDLEWARE_LOCALE_HEADER,
  pickLocaleForMiddleware,
} from './src/lib/i18n/locale-request';

const PREVIEW_COOKIE_NAME = 'gabc_preview';
const ACCESS_PATH = '/gabc-access';

function isGabcPreviewHost(host: string | null) {
  if (!host) return false;
  return host.toLowerCase().startsWith('gabc.');
}

export function middleware(request: NextRequest) {
  // Lightweight preview gate for board-approval deployments.
  // Enabled on host `gabc.*` or when explicitly enabled for local testing.
  const host = request.headers.get('host');
  const previewGateEnabled = process.env.GABC_PREVIEW_GATE_ENABLED === 'true' || isGabcPreviewHost(host);
  if (previewGateEnabled) {
    const { pathname } = request.nextUrl;

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
        url.searchParams.set('next', pathname);
        return NextResponse.redirect(url);
      }
    }
  }

  const cookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const chosen = pickLocaleForMiddleware(cookie, request.headers.get('accept-language'));

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(MIDDLEWARE_LOCALE_HEADER, chosen);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

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
