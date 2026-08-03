'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookmarkPreviewPane } from '@/components/atlas-ops/dil/bookmark-preview-pane';
import { Button } from '@/components/ui/button';
import {
  linkCheckUnreliable,
  linkStatusLabel,
  linkStatusTone,
} from '@/lib/atlas-ops/contact-network/bookmark-link-check';
import { isCustomBookmarkNote, BOOKMARK_REVIEW_BATCH } from '@/lib/atlas-ops/contact-network/bookmark-review-constants';
import {
  fetchBookmarkQueue,
  fetchBookmarkStats,
  recheckBookmarkLink,
  saveBookmarkDecision,
  saveBookmarkNotesOnly,
} from '@/lib/atlas-ops/contact-network/bookmark-review-api-client';
import type {
  BookmarkQueueItem,
  BookmarkReviewDecision,
  BookmarkReviewFilter,
  BookmarkReviewStats,
} from '@/lib/atlas-ops/contact-network/bookmark-review-types';
import {
  bookmarkPruneHint,
  isFetchUnreliableHost,
} from '@/lib/atlas-ops/contact-network/bookmark-triage-heuristics';
import { cn } from '@/lib/utils';

const FILTERS: Array<{ id: BookmarkReviewFilter; label: string }> = [
  { id: 'todo', label: 'To review' },
  { id: 'noted', label: 'Noted' },
  { id: 'kept', label: 'Kept' },
  { id: 'all', label: 'All' },
];

const UNDECIDED_FILTERS: BookmarkReviewFilter[] = ['todo', 'noted'];

function formatAddedAt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function previewTarget(item: BookmarkQueueItem): string {
  return (item.linkFinalUrl ?? item.url).trim();
}

type BookmarkReviewPanelProps = {
  className?: string;
};

export function BookmarkReviewPanel({ className }: BookmarkReviewPanelProps) {
  const [filter, setFilter] = useState<BookmarkReviewFilter>('todo');
  const [queue, setQueue] = useState<BookmarkQueueItem[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueShowing, setQueueShowing] = useState(0);
  const [batchOffset, setBatchOffset] = useState(0);
  const [stats, setStats] = useState<BookmarkReviewStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingLink, setCheckingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [notesSaveState, setNotesSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const skipNotesBlurSave = useRef(false);

  const selected = useMemo(
    () => queue.find((item) => item.id === selectedId) ?? null,
    [queue, selectedId]
  );

  const selectedIndex = useMemo(
    () => (selectedId == null ? -1 : queue.findIndex((item) => item.id === selectedId)),
    [queue, selectedId]
  );

  const refresh = useCallback(async (activeFilter: BookmarkReviewFilter, keepId: number | null, offset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, queueRes] = await Promise.all([
        fetchBookmarkStats(),
        fetchBookmarkQueue(activeFilter, BOOKMARK_REVIEW_BATCH, offset),
      ]);
      setStats(statsRes);
      setQueue(queueRes.items);
      setQueueTotal(queueRes.total);
      setQueueShowing(queueRes.showing);
      setBatchOffset(offset);

      const nextId =
        keepId != null && queueRes.items.some((item) => item.id === keepId)
          ? keepId
          : (queueRes.items[0]?.id ?? null);
      setSelectedId(nextId);
      const nextItem = queueRes.items.find((item) => item.id === nextId);
      setNotes(nextItem?.notes ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(filter, null, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filter changes
  }, [filter]);

  useEffect(() => {
    if (!selected) return;
    setNotes(selected.notes ?? '');
    if (!selected.linkCheckedAt && selected.url) {
      setCheckingLink(true);
      void recheckBookmarkLink(selected.id)
        .then((item) => {
          setQueue((prev) => prev.map((row) => (row.id === item.id ? item : row)));
        })
        .catch(() => {
          /* non-fatal */
        })
        .finally(() => setCheckingLink(false));
    }
  }, [selected?.id]);

  function selectRelative(delta: number): void {
    if (queue.length === 0) return;
    const idx = selectedIndex >= 0 ? selectedIndex : 0;
    const next = queue[(idx + delta + queue.length) % queue.length];
    if (next) setSelectedId(next.id);
  }

  async function persistNotes(id: number, value: string): Promise<boolean> {
    setNotesSaveState('saving');
    try {
      const item = await saveBookmarkNotesOnly(id, value);
      const wasCustom = isCustomBookmarkNote(value);
      setQueue((prev) => {
        if (filter === 'todo' && wasCustom) {
          return prev.filter((row) => row.id !== id);
        }
        return prev.map((row) => (row.id === item.id ? item : row));
      });
      if (filter === 'todo' && wasCustom) {
        setQueueTotal((prev) => Math.max(0, prev - 1));
        setStatusMessage('Notes saved — find it under Noted until you Keep or Delete.');
      }
      setNotesSaveState('saved');
      window.setTimeout(() => setNotesSaveState('idle'), 1200);
      void fetchBookmarkStats().then(setStats);
      return true;
    } catch (err) {
      setNotesSaveState('idle');
      setError(err instanceof Error ? err.message : 'Failed to save notes');
      return false;
    }
  }

  async function decide(decision: BookmarkReviewDecision): Promise<void> {
    if (!selected || saving) return;

    skipNotesBlurSave.current = true;
    setSaving(true);
    setError(null);
    setStatusMessage(null);
    try {
      const result = await saveBookmarkDecision({
        id: selected.id,
        decision,
        notes,
        deleteFromChrome: decision === 'delete',
        recheckLink: false,
      });

      const idx = queue.findIndex((item) => item.id === selected.id);
      const nextQueue = queue.filter((item) => item.id !== selected.id);
      const nextId = nextQueue[idx]?.id ?? nextQueue[idx - 1]?.id ?? nextQueue[0]?.id ?? null;

      const parts: string[] = [];
      if (decision === 'keep') parts.push('Kept');
      if (decision === 'delete') {
        parts.push(result.chromeDeleted ? 'Deleted from Chrome' : 'Archived (Chrome URL not found)');
        if (result.chromeBackupPath) parts.push(`Backup: ${result.chromeBackupPath}`);
      }
      if (result.chromeError && decision === 'delete') parts.push(result.chromeError);
      setStatusMessage(parts.join(' · '));

      void fetchBookmarkStats().then(setStats);
      await refresh(filter, nextId, batchOffset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed');
    } finally {
      setSaving(false);
      skipNotesBlurSave.current = false;
    }
  }

  async function manualLinkCheck(): Promise<void> {
    if (!selected) return;
    setCheckingLink(true);
    try {
      const item = await recheckBookmarkLink(selected.id);
      setQueue((prev) => prev.map((row) => (row.id === item.id ? item : row)));
      setStatusMessage(`Link check: ${linkStatusLabel(item.linkStatus)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Link check failed');
    } finally {
      setCheckingLink(false);
    }
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (typing && !event.ctrlKey && !event.metaKey) {
        if (event.key === 'Enter' && target?.tagName === 'TEXTAREA') {
          event.preventDefault();
          selectRelative(1);
        }
        return;
      }

      if (!selected || saving) return;

      const key = event.key.toLowerCase();
      if (key === 'y') {
        event.preventDefault();
        void decide('keep');
      } else if (key === 'n') {
        event.preventDefault();
        void decide('delete');
      } else if (key === 'j' || key === 'arrowdown') {
        event.preventDefault();
        selectRelative(1);
      } else if (key === 'k' || key === 'arrowup') {
        event.preventDefault();
        selectRelative(-1);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <div className={cn('flex flex-col bg-background text-foreground', className ?? 'h-screen')}>
      <header className="shrink-0 border-b border-border px-4 py-2">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-950 dark:text-amber-200">
          Before <strong>Delete (N)</strong>: quit Chrome completely so bookmark edits are not overwritten on next
          launch.
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight">Bookmark review</h1>
            <p className="text-[11px] text-muted-foreground">
              Oldest first · Y keep · N delete · Notes → Noted tab
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {stats ? (
              <>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">To review: {stats.todo}</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">Noted: {stats.noted}</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">Kept: {stats.kept}</span>
              </>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={loading || saving}
              onClick={() => void refresh(filter, selectedId, batchOffset)}
            >
              Reload
            </Button>
            {UNDECIDED_FILTERS.includes(filter) ? (
              <>
                {batchOffset > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                    disabled={loading || saving}
                    onClick={() => void refresh(filter, null, 0)}
                  >
                    Back to oldest
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={loading || saving || batchOffset + queueShowing >= queueTotal}
                  title="Skip this batch without deciding — leaves items in the queue"
                  onClick={() => void refresh(filter, null, batchOffset + BOOKMARK_REVIEW_BATCH)}
                >
                  Skip ahead {BOOKMARK_REVIEW_BATCH}
                </Button>
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {FILTERS.map((item) => (
            <Button
              key={item.id}
              size="sm"
              className="h-7 px-2.5 text-xs"
              variant={filter === item.id ? 'default' : 'outline'}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
          {queueTotal > 0 ? (
            <p className="ml-auto text-[10px] text-muted-foreground">
              Showing {batchOffset + 1}–{batchOffset + queueShowing} of {queueTotal}
            </p>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      ) : null}
      {statusMessage ? (
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">{statusMessage}</div>
      ) : null}

      {selected ? (
        <>
          <div className="shrink-0 border-b-2 border-primary/30 bg-primary/5 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="bookmark-notes" className="text-sm font-semibold">
                Notes — press out the value (DABOS / GFP / wiki)
              </label>
              <span className="text-[10px] text-muted-foreground">
                {notesSaveState === 'saving'
                  ? 'Saving…'
                  : notesSaveState === 'saved'
                    ? 'Saved'
                    : 'Autosave on blur · Enter = next item'}
              </span>
            </div>
            <textarea
              id="bookmark-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (skipNotesBlurSave.current || !selected) return;
                void persistNotes(selected.id, notes);
              }}
              rows={3}
              placeholder="e.g. potential GFP content — then Keep or Delete when ready"
              className="mt-2 min-h-[4.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="shrink-0 border-b border-border bg-muted/25 px-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button disabled={saving} variant="outline" size="sm" className="h-8" onClick={() => selectRelative(-1)}>
                  Prev
                </Button>
                <Button disabled={saving} variant="outline" size="sm" className="h-8" onClick={() => selectRelative(1)}>
                  Next
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  disabled={saving}
                  size="sm"
                  className="h-8 bg-emerald-600 hover:bg-emerald-600/90"
                  onClick={() => void decide('keep')}
                >
                  Keep (Y)
                </Button>
                <Button
                  disabled={saving}
                  variant="destructive"
                  size="sm"
                  className="h-8"
                  onClick={() => void decide('delete')}
                >
                  Delete (N)
                </Button>
              </div>
              {selectedIndex >= 0 ? (
                <p className="w-full text-center text-[10px] text-muted-foreground sm:w-auto sm:text-right">
                  {selectedIndex + 1} of {queue.length} · ↑/↓ j/k · Y/N
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
        <aside className="min-h-0 overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
            Queue {loading ? '(loading…)' : ''}
          </div>
          {queue.length === 0 && !loading ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">Nothing in this queue.</p>
          ) : (
            <ul className="divide-y divide-border">
              {queue.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-accent/50',
                      selectedId === item.id && 'bg-accent'
                    )}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <div className="truncate font-medium">{item.title || item.url}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                      <span>{formatAddedAt(item.bookmarkAddedAt)}</span>
                      {item.bookmarkQuarter ? <span>· {item.bookmarkQuarter}</span> : null}
                      {item.linkStatus ? (
                        <span className={cn('rounded px-1 py-0.5', linkStatusTone(item.linkStatus))}>
                          {linkStatusLabel(item.linkStatus)}
                        </span>
                      ) : null}
                      {isCustomBookmarkNote(item.notes) ? (
                        <span className="rounded bg-violet-500/15 px-1 py-0.5 text-violet-700 dark:text-violet-300">
                          noted
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="min-h-0 border-b border-border lg:border-b-0 lg:border-r">
          {selected ? (
            <div className="flex h-full min-h-[280px] flex-col">
              <div className="border-b border-border px-4 py-2 text-sm">
                <div className="font-medium">{selected.title || '(no title)'}</div>
                <div className="truncate text-xs text-muted-foreground">{previewTarget(selected)}</div>
              </div>
              <div className="min-h-0 flex-1 bg-muted/20">
                <BookmarkPreviewPane
                  title={selected.title}
                  url={previewTarget(selected)}
                  linkStatus={selected.linkStatus}
                />
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[280px] items-center justify-center p-6 text-sm text-muted-foreground">
              Select a bookmark from the queue.
            </div>
          )}
        </section>

        <aside className="min-h-0 overflow-y-auto p-4">
          {selected ? (
            <div className="space-y-4 text-sm">
              <div>
                <h2 className="text-sm font-semibold">Details</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Added {formatAddedAt(selected.bookmarkAddedAt)}
                  {selected.bookmarkQuarter ? ` · ${selected.bookmarkQuarter}` : ''}
                </p>
                {selected.listName ? (
                  <p className="mt-1 text-xs text-muted-foreground">{selected.listName}</p>
                ) : null}
                {(() => {
                  const hint = bookmarkPruneHint(selected.listName);
                  if (!hint) return null;
                  return (
                    <p
                      className={cn(
                        'mt-2 rounded-md px-2 py-1.5 text-[11px]',
                        hint.level === 'high'
                          ? 'border border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100'
                          : 'border border-border bg-muted/40 text-muted-foreground'
                      )}
                    >
                      <strong className="font-medium text-foreground">Triage hint:</strong> {hint.reason}
                    </p>
                  );
                })()}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'rounded-md px-2 py-0.5 text-xs font-medium',
                    linkStatusTone(selected.linkStatus)
                  )}
                >
                  {checkingLink ? 'Checking…' : linkStatusLabel(selected.linkStatus)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={checkingLink}
                  onClick={() => void manualLinkCheck()}
                >
                  Recheck link
                </Button>
              </div>

              {selected.linkFinalUrl && selected.linkFinalUrl !== selected.url ? (
                <p className="text-xs text-muted-foreground">
                  Redirects to{' '}
                  <a
                    href={selected.linkFinalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {selected.linkFinalUrl}
                  </a>
                </p>
              ) : null}

              {selected.linkCheckNote ? (
                <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {selected.linkCheckNote}
                </p>
              ) : null}

              {linkCheckUnreliable(selected.linkStatus) || isFetchUnreliableHost(selected.url) ? (
                <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                  Automated fetch is unreliable for this host — trust <strong>Open in browser</strong>, not
                  the badge. Many deletes in your session were live links anyway.
                </p>
              ) : null}

              <p className="text-[11px] text-muted-foreground">
                Keep = curated corpus. Delete = remove from Chrome + archive. Custom notes move the item to{' '}
                <strong>Noted</strong> until you decide.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a bookmark.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
