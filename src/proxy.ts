import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const EUER_ACCESS = '/euer-access';
const EUER_HOME = '/euer';

function isEuerHost(host: string) {
  return host.startsWith('euer.');
}

function isGabcHost(host: string) {
  return host.startsWith('gabc.');
}

export function proxy(request: NextRequest) {
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '').toLowerCase();
  const { pathname } = request.nextUrl;
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
