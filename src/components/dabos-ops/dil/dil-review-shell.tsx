'use client';

import { useState } from 'react';
import { BookmarkReviewPanel } from '@/components/dabos-ops/dil/bookmark-review-panel';
import { DilReviewAbout } from '@/components/dabos-ops/dil/dil-review-about';
import { ReviewWorkbench } from '@/components/dabos-ops/dil/review-workbench';
import { Button } from '@/components/ui/button';

type ReviewMode = 'files' | 'bookmarks' | 'about';

export function DilReviewShell() {
  const [mode, setMode] = useState<ReviewMode>('files');

  return (
    <div className="flex h-screen flex-col">
      <nav className="flex shrink-0 items-center gap-1 border-b border-border bg-muted/30 px-4 py-1.5">
        <span className="mr-2 text-xs font-medium text-muted-foreground" title="Document Intake & Lifecycle">
          DIL Review
        </span>
        <Button
          size="sm"
          className="h-7 px-3 text-xs"
          variant={mode === 'files' ? 'default' : 'outline'}
          onClick={() => setMode('files')}
        >
          Files
        </Button>
        <Button
          size="sm"
          className="h-7 px-3 text-xs"
          variant={mode === 'bookmarks' ? 'default' : 'outline'}
          onClick={() => setMode('bookmarks')}
        >
          Bookmarks
        </Button>
        <Button
          size="sm"
          className="ml-auto h-7 px-3 text-xs"
          variant={mode === 'about' ? 'default' : 'outline'}
          onClick={() => setMode('about')}
        >
          About
        </Button>
      </nav>
      <div className="min-h-0 flex-1">
        {mode === 'files' ? (
          <ReviewWorkbench className="h-full" />
        ) : mode === 'bookmarks' ? (
          <BookmarkReviewPanel className="h-full" />
        ) : (
          <DilReviewAbout className="h-full" />
        )}
      </div>
    </div>
  );
}
