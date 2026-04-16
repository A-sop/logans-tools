import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  LOCALE_COOKIE_NAME,
  MIDDLEWARE_LOCALE_HEADER,
  pickLocaleForMiddleware,
} from './src/lib/i18n/locale-request';

export function middleware(request: NextRequest) {
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
