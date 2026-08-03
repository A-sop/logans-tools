import type { BookmarkLinkStatus } from '@/lib/atlas-ops/contact-network/bookmark-review-types';

export interface BookmarkLinkCheckResult {
  url: string;
  status: BookmarkLinkStatus;
  httpStatus: number | null;
  finalUrl: string | null;
  note: string;
  checkedAt: string;
}

const DEFAULT_TIMEOUT_MS = 20_000;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function candidateUrls(url: string): string[] {
  const trimmed = url.trim();
  const out = [trimmed];
  if (trimmed.startsWith('http://')) {
    const https = `https://${trimmed.slice('http://'.length)}`;
    if (!out.includes(https)) out.push(https);
  }
  return out;
}

function classifyHttpStatus(
  url: string,
  res: Response,
  finalUrl: string,
  method: string
): BookmarkLinkCheckResult {
  const checkedAt = new Date().toISOString();
  const redirected = finalUrl !== url;

  if (res.status >= 200 && res.status < 400) {
    return {
      url,
      status: redirected ? 'redirect_ok' : 'live',
      httpStatus: res.status,
      finalUrl,
      note: redirected ? 'Redirects but still reachable.' : 'Reachable.',
      checkedAt,
    };
  }

  if (
    res.status === 403 ||
    res.status === 401 ||
    res.status === 429 ||
    res.status === 999 ||
    res.status === 520 ||
    res.status === 521 ||
    res.status === 522
  ) {
    const cf = res.headers.get('cf-ray');
    return {
      url,
      status: 'blocked',
      httpStatus: res.status,
      finalUrl,
      note:
        res.status === 999
          ? 'Bot block (HTTP 999) — often works in Chrome, not in automated fetch.'
          : cf
            ? `${res.status} via Cloudflare — may still open in Chrome.`
            : `${res.status} access denied — may still open in browser (${method}).`,
      checkedAt,
    };
  }

  if (res.status === 404 || res.status === 410) {
    return {
      url,
      status: 'dead',
      httpStatus: res.status,
      finalUrl,
      note: 'Not found — strong delete candidate.',
      checkedAt,
    };
  }

  return {
    url,
    status: 'error',
    httpStatus: res.status,
    finalUrl,
    note: `HTTP ${res.status} — verify in browser before deleting.`,
    checkedAt,
  };
}

function classifyNetworkError(url: string, err: unknown): BookmarkLinkCheckResult {
  const checkedAt = new Date().toISOString();
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    err instanceof Error &&
    err.cause &&
    typeof err.cause === 'object' &&
    'code' in err.cause
      ? String((err.cause as { code?: string }).code)
      : undefined;

  if (/abort|timeout/i.test(msg)) {
    return {
      url,
      status: 'timeout',
      httpStatus: null,
      finalUrl: null,
      note: 'Fetch timed out — site may be slow; try Open in browser.',
      checkedAt,
    };
  }
  if (/ENOTFOUND|getaddrinfo/i.test(msg) || code === 'ENOTFOUND') {
    return {
      url,
      status: 'dead',
      httpStatus: null,
      finalUrl: null,
      note: 'Domain does not resolve — likely gone.',
      checkedAt,
    };
  }
  if (/ECONNREFUSED|ECONNRESET/i.test(msg)) {
    return {
      url,
      status: 'dead',
      httpStatus: null,
      finalUrl: null,
      note: 'Nothing listening on host — often abandoned.',
      checkedAt,
    };
  }
  if (/certificate|SSL|TLS|SELF_SIGNED/i.test(msg) || code?.includes('CERT')) {
    return {
      url,
      status: 'error',
      httpStatus: null,
      finalUrl: null,
      note: `TLS error (${code ?? 'cert'}) — may work in Chrome with warnings.`,
      checkedAt,
    };
  }

  return {
    url,
    status: 'error',
    httpStatus: null,
    finalUrl: null,
    note: `Fetch failed (${code ?? msg.slice(0, 60)}) — use Open in browser; not proof site is dead.`,
    checkedAt,
  };
}

async function probeOnce(
  url: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number
): Promise<BookmarkLinkCheckResult | { err: unknown } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: BROWSER_HEADERS,
    });
    if (method === 'GET' && res.body) {
      await res.body.cancel();
    }
    if (method === 'HEAD' && res.status === 405) {
      return null;
    }
    return classifyHttpStatus(url, res, res.url, method);
  } catch (err) {
    return { err };
  } finally {
    clearTimeout(timer);
  }
}

export async function checkBookmarkUrl(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<BookmarkLinkCheckResult> {
  let lastErr: unknown = null;

  for (const candidate of candidateUrls(url)) {
    const head = await probeOnce(candidate, 'HEAD', timeoutMs);
    if (head && 'status' in head) {
      return head;
    }
    if (head && 'err' in head) {
      lastErr = head.err;
    }

    const get = await probeOnce(candidate, 'GET', timeoutMs);
    if (get && 'status' in get) {
      return get;
    }
    if (get && 'err' in get) {
      lastErr = get.err;
    }
  }

  if (lastErr) return classifyNetworkError(url, lastErr);
  return {
    url,
    status: 'error',
    httpStatus: null,
    finalUrl: null,
    note: 'Fetch failed — use Open in browser; not proof site is dead.',
    checkedAt: new Date().toISOString(),
  };
}

export function linkStatusTone(status: BookmarkLinkStatus | null): string {
  switch (status) {
    case 'live':
    case 'redirect_ok':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
    case 'dead':
      return 'bg-destructive/15 text-destructive';
    case 'blocked':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-400';
    case 'timeout':
    case 'error':
    case 'unknown':
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function linkStatusLabel(status: BookmarkLinkStatus | null): string {
  switch (status) {
    case 'live':
      return 'Live';
    case 'redirect_ok':
      return 'Redirect OK';
    case 'dead':
      return 'Dead (404/gone)';
    case 'blocked':
      return 'Bot-blocked (try browser)';
    case 'timeout':
      return 'Timeout (try browser)';
    case 'error':
      return 'Check failed (try browser)';
    default:
      return 'Not checked';
  }
}

export function linkCheckUnreliable(status: BookmarkLinkStatus | null): boolean {
  return status === 'blocked' || status === 'error' || status === 'timeout';
}
