'use client';

import type { BookmarkLinkStatus } from '@/lib/dabos-ops/contact-network/bookmark-review-types';

type BookmarkPreviewPaneProps = {
  title: string;
  url: string;
  linkStatus: BookmarkLinkStatus | null;
};

function previewUrl(url: string): string {
  return url.trim();
}

export function BookmarkPreviewPane({ title, url, linkStatus }: BookmarkPreviewPaneProps) {
  const src = previewUrl(url);

  if (!src) {
    return (
      <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-sm text-muted-foreground">
        No URL to preview.
      </div>
    );
  }

  if (linkStatus === 'dead') {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Inline preview skipped â€” link looks dead (404 or host gone).
        </p>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          Open in browser anyway
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[280px] flex-col">
      <iframe
        key={src}
        title={title || 'Bookmark preview'}
        src={src}
        className="min-h-0 flex-1 w-full border-0 bg-background"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">
        <span>
          {linkStatus === 'blocked' || linkStatus === 'error' || linkStatus === 'timeout'
            ? 'Automated check was inconclusive â€” preview may still work.'
            : 'If preview is blank, the site blocks embedding.'}
        </span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-medium text-primary hover:underline"
        >
          Open in browser
        </a>
      </div>
    </div>
  );
}
