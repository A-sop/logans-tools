import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  dabosSubdomainPath,
  isDabosAppPath,
  isDabosHost,
  isLogansToolsApexHost,
  normalizeHost,
} from './src/lib/dabos/host';
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

const MARKETING_LAYOUT_HEADER = 'x-marketing-layout';

function isExpatHost(host: string | null | undefined) {
  if (!host) return false;
  const h = host.toLowerCase();
  return h.startsWith('expat.') || h === 'expat.logans.tools';
}

function isStaticPassthrough(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  );
}

export function middleware(request: NextRequest) {
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.host;
  const hostname = request.nextUrl.hostname;
  const debugHost = host ?? '';
  const debugHostname = hostname ?? '';
  const { pathname, search } = request.nextUrl;

  const cookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const chosen = pickLocaleForMiddleware(cookie, request.headers.get('accept-language'));

  function withLocaleHeaders(headers: Headers): Headers {
    headers.set(MIDDLEWARE_LOCALE_HEADER, chosen);
    return headers;
  }

  const isDabosSubdomain = isDabosHost(host, hostname);
  const isDabosPath = isDabosAppPath(pathname);

  if (
    process.env.NODE_ENV === 'production' &&
    isLogansToolsApexHost(hostname) &&
    isDabosPath &&
    !pathname.startsWith('/api/')
  ) {
    const dest = request.nextUrl.clone();
    dest.hostname = 'dabos.logans.tools';
    dest.protocol = 'https:';
    dest.pathname = dabosSubdomainPath(pathname);
    return NextResponse.redirect(dest, 308);
  }

  if (isDabosSubdomain && !pathname.startsWith('/api/') && !isStaticPassthrough(pathname)) {
    const requestHeaders = withLocaleHeaders(new Headers(request.headers));
    requestHeaders.set(MARKETING_LAYOUT_HEADER, '1');

    const url = request.nextUrl.clone();
    if (pathname === '/') {
      url.pathname = '/dabos';
      url.search = search ?? '';
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }

    if (!pathname.startsWith('/dabos')) {
      url.pathname = `/dabos${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
      url.search = search ?? '';
      return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
  }

  const previewGateEnabled =
    process.env.GABC_PREVIEW_GATE_ENABLED === 'true' ||
    isGabcPreviewHost(host) ||
    normalizeHost(hostname) === 'gabc.logans.tools';

  const isExpatSubdomain = isExpatHost(host) || normalizeHost(hostname) === 'expat.logans.tools';
  const isMarketingPath = pathname === '/expat' || pathname.startsWith('/expat/');

  if (isExpatSubdomain && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/expat';
    url.search = search ?? '';
    const requestHeaders = withLocaleHeaders(new Headers(request.headers));
    requestHeaders.set(MARKETING_LAYOUT_HEADER, '1');
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  if (previewGateEnabled) {
    const isAccessPage = pathname === ACCESS_PATH;
    const isAllowedPublicAsset = isStaticPassthrough(pathname);

    if (!isAccessPage && !isAllowedPublicAsset) {
      const hasPreviewCookie = request.cookies.get(PREVIEW_COOKIE_NAME)?.value === '1';
      if (!hasPreviewCookie) {
        const url = request.nextUrl.clone();
        url.pathname = ACCESS_PATH;
        const next = pathname === '/' ? DEFAULT_AFTER_ACCESS : `${pathname}${search ?? ''}`;
        url.searchParams.set('next', next);
        const res = NextResponse.redirect(url);
        res.headers.set('x-gabc-preview-mw', '1');
        res.headers.set('x-gabc-debug-host', debugHost);
        res.headers.set('x-gabc-debug-hostname', debugHostname);
        return res;
      }
    }

    if (pathname === '/' && request.cookies.get(PREVIEW_COOKIE_NAME)?.value === '1') {
      const url = request.nextUrl.clone();
      url.pathname = DEFAULT_AFTER_ACCESS;
      url.search = '';
      const res = NextResponse.redirect(url);
      res.headers.set('x-gabc-preview-mw', '1');
      res.headers.set('x-gabc-debug-host', debugHost);
      res.headers.set('x-gabc-debug-hostname', debugHostname);
      return res;
    }
  }

  const requestHeaders = withLocaleHeaders(new Headers(request.headers));
  if (isMarketingPath || isExpatSubdomain || isDabosSubdomain || isDabosPath) {
    requestHeaders.set(MARKETING_LAYOUT_HEADER, '1');
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-gabc-debug-host', debugHost);
  response.headers.set('x-gabc-debug-hostname', debugHostname);
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
