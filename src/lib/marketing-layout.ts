import { isDabosAppPath, isDabosHost, normalizeHost } from '@/lib/dabos/host';

export function isExpatHost(host: string | null | undefined): boolean {
  const h = normalizeHost(host);
  return h.startsWith('expat.') || h === 'expat.logans.tools';
}

export function isExpatPath(pathname: string): boolean {
  return pathname === '/expat' || pathname.startsWith('/expat/');
}

export function isAuthPath(pathname: string): boolean {
  return pathname === '/sign-in' || pathname.startsWith('/sign-in/');
}

/** Skip Logans.Tools AppShell — DABOS, expat, auth, and other standalone surfaces. */
export function shouldUseMarketingLayout(
  hostHeader: string | null | undefined,
  pathname: string | null | undefined,
  middlewareFlag: boolean
): boolean {
  if (middlewareFlag) return true;

  const host = normalizeHost(hostHeader);
  if (isDabosHost(host) || isExpatHost(host)) return true;

  if (pathname) {
    if (isDabosAppPath(pathname)) return true;
    if (isExpatPath(pathname)) return true;
    if (isAuthPath(pathname)) return true;
  }

  return false;
}
