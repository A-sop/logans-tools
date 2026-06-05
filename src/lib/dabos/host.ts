/** Hostname without port, lowercased. */
export function normalizeHost(host: string | null | undefined): string {
  if (!host) return '';
  return host.toLowerCase().split(':')[0] ?? '';
}

export function isDabosHost(host: string | null | undefined, hostname?: string): boolean {
  const h = normalizeHost(host ?? hostname);
  return h.startsWith('dabos.') || h === 'dabos.logans.tools';
}

export function isDabosAppPath(pathname: string): boolean {
  return pathname === '/dabos' || pathname.startsWith('/dabos/');
}

export function isLogansToolsApexHost(hostname: string): boolean {
  const h = normalizeHost(hostname);
  return h === 'logans.tools' || h === 'www.logans.tools';
}

/** Map /dabos/... on apex to clean paths on dabos.logans.tools */
export function dabosSubdomainPath(pathname: string): string {
  if (pathname === '/dabos') return '/';
  if (pathname.startsWith('/dabos/')) return pathname.slice('/dabos'.length) || '/';
  return pathname;
}
