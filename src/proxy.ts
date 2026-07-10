import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  dabosAccessDeniedPage,
  isDabosEmailAllowlisted,
} from '@/lib/dabos/clerk-auth';
import {
  dabosSubdomainPath,
  isDabosAppPath,
  isDabosHost,
  isLogansToolsApexHost,
  normalizeHost,
} from '@/lib/dabos/host';
import {
  LOCALE_COOKIE_NAME,
  MIDDLEWARE_LOCALE_HEADER,
  pickLocaleForMiddleware,
} from '@/lib/i18n/locale-request';
import { isAuthPath } from '@/lib/marketing-layout';

const EUER_ACCESS = '/euer-access';
const EUER_HOME = '/euer';
const PREVIEW_COOKIE_NAME = 'gabc_preview';
const ACCESS_PATH = '/gabc-access';
const DEFAULT_AFTER_ACCESS = '/gabc';

const MARKETING_LAYOUT_HEADER = 'x-marketing-layout';
/** Becomes `x-middleware-request-pathname` on the upstream request. */
const PATHNAME_HEADER = 'pathname';

const isAuthPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)']);

function isEuerHost(host: string) {
  return host.startsWith('euer.');
}

function isGabcHost(host: string) {
  return host.startsWith('gabc.');
}

function isGabcPreviewHost(host: string | null | undefined) {
  if (!host) return false;
  return host.toLowerCase().startsWith('gabc.');
}

function isExpatHost(host: string | null | undefined) {
  if (!host) return false;
  const h = host.toLowerCase();
  return h.startsWith('expat.') || h === 'expat.logans.tools';
}

function isClerkInternalPath(pathname: string): boolean {
  return pathname.startsWith('/clerk_');
}

function isStaticPassthrough(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  );
}

function isDabosCronPath(pathname: string): boolean {
  return pathname.startsWith('/api/dabos/cron/');
}

function isDabosTier0Path(pathname: string): boolean {
  return pathname.startsWith('/api/dabos/tier0/');
}

function isDabosSlackPath(pathname: string): boolean {
  return pathname.startsWith('/api/dabos/slack/');
}

function isDabosProtectedRequest(request: NextRequest): boolean {
  if (isAuthPublicRoute(request)) return false;

  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.host;
  const hostname = request.nextUrl.hostname;
  const { pathname } = request.nextUrl;

  if (isDabosCronPath(pathname)) return false;
  if (isDabosTier0Path(pathname)) return false;
  if (isDabosSlackPath(pathname)) return false;
  if (pathname.startsWith('/api/dabos')) return true;
  if (isDabosAppPath(pathname)) return true;
  if (isDabosHost(host, hostname) && !isStaticPassthrough(pathname)) return true;

  return false;
}

function runAppProxy(request: NextRequest): NextResponse {
  const hostRaw =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.host;
  const host = hostRaw.toLowerCase();
  const hostname = request.nextUrl.hostname;
  const debugHost = hostRaw ?? '';
  const debugHostname = hostname ?? '';
  const { pathname, search } = request.nextUrl;
  const hasEuerAccess = request.cookies.get('euer_preview')?.value === '1';

  if (
    pathname.startsWith('/euer') &&
    !pathname.startsWith('/euer-access') &&
    !pathname.startsWith('/_next') &&
    !hasEuerAccess
  ) {
    const url = request.nextUrl.clone();
    url.pathname = EUER_ACCESS;
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isEuerHost(host)) {
    if (pathname.startsWith('/euer-access') || pathname.startsWith('/_next')) {
      return NextResponse.next();
    }

    if (pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = hasEuerAccess ? EUER_HOME : EUER_ACCESS;
      return NextResponse.redirect(url);
    }
  }

  if (isGabcHost(host) && pathname === '/') {
    const hasPreview = request.cookies.get('gabc_preview')?.value === '1';
    const url = request.nextUrl.clone();
    url.pathname = hasPreview ? '/gabc' : '/gabc-access';
    if (!hasPreview) {
      url.searchParams.set('next', '/gabc');
    }
    return NextResponse.redirect(url);
  }

  const cookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const chosen = pickLocaleForMiddleware(cookie, request.headers.get('accept-language'));

  function withLocaleHeaders(headers: Headers): Headers {
    headers.set(MIDDLEWARE_LOCALE_HEADER, chosen);
    headers.set(PATHNAME_HEADER, pathname);
    return headers;
  }

  const isDabosSubdomain = isDabosHost(host, hostname);
  const isDabosPath = isDabosAppPath(pathname);

  if (
    isLogansToolsApexHost(normalizeHost(host)) &&
    isDabosPath &&
    !pathname.startsWith('/api/')
  ) {
    const target = new URL(dabosSubdomainPath(pathname), 'https://dabos.logans.tools');
    target.search = search ?? '';
    return NextResponse.redirect(target, 308);
  }

  if (
    isDabosSubdomain &&
    !pathname.startsWith('/api/') &&
    !isStaticPassthrough(pathname) &&
    !isAuthPath(pathname) &&
    !isClerkInternalPath(pathname)
  ) {
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

export default clerkMiddleware(async (auth, request) => {
  if (isDabosProtectedRequest(request)) {
    await auth.protect();

    const { userId } = await auth();
    if (userId && !(await isDabosEmailAllowlisted(userId))) {
      if (request.nextUrl.pathname.startsWith('/api/dabos')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return dabosAccessDeniedPage(request.url);
    }
  }

  return runAppProxy(request);
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    '/(api|trpc)(.*)',
  ],
};
