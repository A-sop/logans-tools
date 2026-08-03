'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PathAutocompleteInput } from '@/components/atlas-ops/dil/path-autocomplete-input';
import { cn } from '@/lib/utils';
import {
  DIL_REVIEW_UI_BATCH,
  classifyInboxBatch,
  fetchPilotV3Extraction,
  fetchReviewQueue,
  fetchReviewStats,
  filePreviewUrl,
  saveReviewDecision,
} from '@/lib/atlas-ops/document-intake/review-api-client';
import { mergeFilingOverrides, resolveEffectiveFiling } from '@/lib/atlas-ops/document-intake/review-filing';
import {
  buildMotivationalProgress,
  ensureDayBaseline,
  ensureReviewSession,
  mergeDayProgress,
  recordReviewSessionDecision,
  resetReviewSession,
  type MotivationalProgress,
  type ReviewSessionSnapshot,
} from '@/lib/atlas-ops/document-intake/review-session-tracker';
import type { ReviewApproval, ReviewQueueFilter, ReviewQueueItem, ReviewStats } from '@/lib/atlas-ops/document-intake/review-types';

const REVIEW_BATCH = DIL_REVIEW_UI_BATCH;
const BATCHED_FILTERS: ReviewQueueFilter[] = ['todo', 'admin', 'noted'];

function batchOffsetKey(activeFilter: ReviewQueueFilter): string {
  return `dil-review-batch-offset:${activeFilter}`;
}

const FILTERS: Array<{ id: ReviewQueueFilter; label: string }> = [
  { id: 'todo', label: 'To review' },
  { id: 'noted', label: 'Noted' },
  { id: 'admin', label: 'Admin (2026 taxes first)' },
  { id: 'later', label: 'Later' },
  { id: 'decided', label: 'Decided' },
  { id: 'all', label: 'All' },
];

function approvalLabel(approved: ReviewApproval): string {
  switch (approved) {
    case 'Y':
      return 'Yes';
    case 'N':
      return 'No';
    case 'L':
      return 'Later';
    case 'flag':
      return 'Flag';
    default:
      return 'Pending';
  }
}

function approvalTone(approved: ReviewApproval): string {
  switch (approved) {
    case 'Y':
      return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
    case 'N':
      return 'bg-destructive/15 text-destructive';
    case 'L':
      return 'bg-amber-500/15 text-amber-800 dark:text-amber-400';
    case 'flag':
      return 'bg-violet-500/15 text-violet-700 dark:text-violet-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function syncItemFormState(item: ReviewQueueItem): {
  notes: string;
  keepFilename: boolean;
  basenameOverride: string;
  relativePathOverride: string;
} {
  return {
    notes: item.reviewNotes ?? '',
    keepFilename: item.keepFilename,
    basenameOverride: item.basenameOverride,
    relativePathOverride: item.relativePathOverride,
  };
}

export function ReviewWorkbench({ className }: { className?: string } = {}) {
  const [filter, setFilter] = useState<ReviewQueueFilter>('todo');
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueShowing, setQueueShowing] = useState(0);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [keepFilename, setKeepFilename] = useState(false);
  const [basenameOverride, setBasenameOverride] = useState('');
  const [relativePathOverride, setRelativePathOverride] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  async function runApplyApproved(): Promise<void> {
    setApplying(true);
    try {
      const dryRes = await fetch('/api/dabos/dil/review/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ execute: false }),
      });
      const dry = (await dryRes.json()) as { ok?: boolean; output?: string; error?: string };
      if (!dry.ok) {
        window.alert(`Apply dry-run failed:\n${dry.error ?? dry.output ?? 'unknown error'}`);
        return;
      }
      const go = window.confirm(
        `DRY RUN — nothing moved yet.\n\n${(dry.output ?? '').slice(-1800)}\n\nExecute these moves/renames for real?`,
      );
      if (!go) return;
      const execRes = await fetch('/api/dabos/dil/review/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ execute: true }),
      });
      const exec = (await execRes.json()) as { ok?: boolean; output?: string; error?: string };
      window.alert(
        exec.ok
          ? `Applied.\n\n${(exec.output ?? '').slice(-1800)}`
          : `Apply FAILED:\n${exec.error ?? exec.output ?? 'unknown error'}`,
      );
      await refresh(filter, selectedPath, { offset: batchOffset });
    } finally {
      setApplying(false);
    }
  }
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [session, setSession] = useState<ReviewSessionSnapshot | null>(null);
  const [motivation, setMotivation] = useState<MotivationalProgress | null>(null);
  const [batchOffset, setBatchOffset] = useState(0);
  const [v3Extraction, setV3Extraction] = useState<Awaited<ReturnType<typeof fetchPilotV3Extraction>>['extraction']>(null);
  const [v3Loading, setV3Loading] = useState(false);
  const [notesSaveState, setNotesSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const selectedIndex = useMemo(
    () => (selectedPath ? queue.findIndex((item) => item.sourcePath === selectedPath) : -1),
    [queue, selectedPath]
  );

  const selected = selectedIndex >= 0 ? queue[selectedIndex] : null;

  const syncMotivation = useCallback((nextStats: ReviewStats, nextSession?: ReviewSessionSnapshot | null) => {
    const activeSession = nextSession ?? session ?? ensureReviewSession(nextStats);
    const dayBaseline = ensureDayBaseline(nextStats);
    const base = buildMotivationalProgress(nextStats, activeSession, dayBaseline);
    setSession(activeSession);
    setMotivation(mergeDayProgress(base, nextStats.decidedToday, dayBaseline));
  }, [session]);

  const applyQueueResponse = useCallback(
    (queueResponse: Awaited<ReturnType<typeof fetchReviewQueue>>, keepPath?: string | null) => {
      const nextQueue = queueResponse.items;
      setQueue(nextQueue);
      setQueueTotal(queueResponse.total);
      setQueueShowing(queueResponse.showing);
      setBatchOffset(queueResponse.offset);

      if (nextQueue.length === 0) {
        setSelectedPath(null);
        setNotes('');
        setKeepFilename(false);
        setBasenameOverride('');
        setRelativePathOverride('');
        return;
      }

      const stillExists = keepPath && nextQueue.some((item) => item.sourcePath === keepPath);
      const nextPath = stillExists ? keepPath! : nextQueue[0]!.sourcePath;
      setSelectedPath(nextPath);
      const nextItem = nextQueue.find((item) => item.sourcePath === nextPath);
      setNotes(nextItem?.reviewNotes ?? '');
      setKeepFilename(nextItem?.keepFilename ?? false);
      setBasenameOverride(nextItem?.basenameOverride ?? '');
      setRelativePathOverride(nextItem?.relativePathOverride ?? '');
    },
    []
  );

  /** Instant: registry read only — never OCR. */
  const refresh = useCallback(
    async (
      activeFilter: ReviewQueueFilter,
      keepPath?: string | null,
      options?: { offset?: number; statsFull?: boolean }
    ) => {
      setLoading(true);
      setError(null);
      try {
        const offset = options?.offset ?? (BATCHED_FILTERS.includes(activeFilter) ? batchOffset : 0);
        const [queueResponse, nextStats] = await Promise.all([
          fetchReviewQueue(activeFilter, BATCHED_FILTERS.includes(activeFilter) ? REVIEW_BATCH : 'all', offset),
          fetchReviewStats({ full: options?.statsFull }),
        ]);
        setStats((prev) => ({
          ...nextStats,
          unprocessedInbox: options?.statsFull ? nextStats.unprocessedInbox : (prev?.unprocessedInbox ?? nextStats.unprocessedInbox),
        }));
        syncMotivation(nextStats);
        let page = queueResponse;
        if (
          BATCHED_FILTERS.includes(activeFilter) &&
          page.items.length === 0 &&
          page.total > 0 &&
          page.offset > 0
        ) {
          sessionStorage.setItem(batchOffsetKey(activeFilter), '0');
          setBatchOffset(0);
          page = await fetchReviewQueue(activeFilter, REVIEW_BATCH, 0);
        }
        applyQueueResponse(page, keepPath);
        if (BATCHED_FILTERS.includes(activeFilter)) {
          sessionStorage.setItem(batchOffsetKey(activeFilter), String(page.offset));
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load review data');
      } finally {
        setLoading(false);
      }
    },
    [applyQueueResponse, batchOffset, syncMotivation]
  );

  /** Pull the next working set after finishing or skipping a batch (still instant). */
  const loadNextReviewBatch = useCallback(async () => {
    const nextOffset = BATCHED_FILTERS.includes(filter) ? batchOffset + REVIEW_BATCH : 0;
    if (BATCHED_FILTERS.includes(filter)) {
      setBatchOffset(nextOffset);
      sessionStorage.setItem(batchOffsetKey(filter), String(nextOffset));
    }
    await refresh(filter, null, { offset: nextOffset });
  }, [batchOffset, filter, refresh]);

  const loadFreshReviewBatch = useCallback(async () => {
    setBatchOffset(0);
    sessionStorage.setItem(batchOffsetKey(filter), '0');
    await refresh(filter, null, { offset: 0 });
  }, [filter, refresh]);

  const runClassifyBatch = useCallback(async () => {
    setProcessing(true);
    setError(null);
    setStatusMessage(`Classifying up to ${REVIEW_BATCH} new inbox files (OCR — may take a few minutes)…`);
    try {
      const result = await classifyInboxBatch(REVIEW_BATCH);
      await refresh(filter, null, { offset: 0, statsFull: true });
      const remaining = Math.max(0, result.candidates - result.processed);
      setStatusMessage(
        `Classify done: ${result.processed} new in registry (${Math.round(result.elapsedMs / 1000)}s). ~${remaining} inbox files still unclassified.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to classify inbox batch');
    } finally {
      setProcessing(false);
    }
  }, [filter, refresh]);

  useEffect(() => {
    const saved = Number.parseInt(sessionStorage.getItem(batchOffsetKey(filter)) ?? '0', 10);
    const offset = Number.isFinite(saved) && saved >= 0 ? saved : 0;
    setBatchOffset(offset);
    void refresh(filter, selectedPath, { offset, statsFull: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filter changes
  }, [filter]);

  useEffect(() => {
    if (!selected) return;
    setNotes(selected.reviewNotes ?? '');
    setKeepFilename(selected.keepFilename);
    setBasenameOverride(selected.basenameOverride);
    setRelativePathOverride(selected.relativePathOverride);
  }, [selected?.sourcePath]);

  useEffect(() => {
    if (!selected?.sourcePath) {
      setV3Extraction(null);
      return;
    }
    let cancelled = false;
    setV3Loading(true);
    void fetchPilotV3Extraction(selected.sourcePath)
      .then((res) => {
        if (!cancelled) setV3Extraction(res.extraction);
      })
      .catch(() => {
        if (!cancelled) setV3Extraction(null);
      })
      .finally(() => {
        if (!cancelled) setV3Loading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.sourcePath]);

  const filingPreview = useMemo(() => {
    if (!selected) return null;
    const merged = mergeFilingOverrides(
      notes,
      selected.sourcePath,
      selected.proposedBasename,
      selected.proposedRelativePath,
      { keepFilename, basenameOverride, relativePathOverride }
    );
    return resolveEffectiveFiling({
      sourcePath: selected.sourcePath,
      proposedBasename: selected.proposedBasename,
      proposedRelativePath: selected.proposedRelativePath,
      keepFilename: merged.keepFilename,
      basenameOverride: merged.basenameOverride,
      relativePathOverride: merged.relativePathOverride,
    });
  }, [selected, notes, keepFilename, basenameOverride, relativePathOverride]);

  const autosaveNotes = useCallback(async () => {
    if (!selected) return;
    const trimmed = notes.trim();
    const saved = (selected.reviewNotes ?? '').trim();
    if (trimmed === saved) return;
    setNotesSaveState('saving');
    setSaving(true);
    setError(null);
    try {
      const updated = await saveReviewDecision({
        sourcePath: selected.sourcePath,
        approved: selected.approved,
        reviewNotes: notes,
        keepFilename,
        basenameOverride,
        relativePathOverride,
      });
      setQueue((prev) => prev.map((item) => (item.sourcePath === updated.sourcePath ? updated : item)));
      const form = syncItemFormState(updated);
      setNotes(form.notes);
      setKeepFilename(form.keepFilename);
      setBasenameOverride(form.basenameOverride);
      setRelativePathOverride(form.relativePathOverride);
      setNotesSaveState('saved');
      window.setTimeout(() => setNotesSaveState('idle'), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save notes');
      setNotesSaveState('idle');
    } finally {
      setSaving(false);
    }
  }, [basenameOverride, keepFilename, notes, relativePathOverride, selected]);

  const selectQueueItem = useCallback(
    async (sourcePath: string) => {
      if (sourcePath === selectedPath) return;
      await autosaveNotes();
      setSelectedPath(sourcePath);
      setNotesSaveState('idle');
    },
    [autosaveNotes, selectedPath]
  );

  const selectRelative = useCallback(
    async (delta: number) => {
      if (queue.length === 0) return;
      await autosaveNotes();
      const baseIndex = selectedIndex >= 0 ? selectedIndex : 0;
      const nextIndex = Math.min(Math.max(baseIndex + delta, 0), queue.length - 1);
      const nextItem = queue[nextIndex];
      if (nextItem) {
        setSelectedPath(nextItem.sourcePath);
        setNotes(nextItem.reviewNotes ?? '');
        setKeepFilename(nextItem.keepFilename);
        setBasenameOverride(nextItem.basenameOverride);
        setRelativePathOverride(nextItem.relativePathOverride);
        setNotesSaveState('idle');
      }
    },
    [autosaveNotes, queue, selectedIndex]
  );

  const submitDecision = useCallback(
    async (approved: ReviewApproval, advance = true) => {
      if (!selected) return;
      setSaving(true);
      setError(null);
      try {
        await saveReviewDecision({
          sourcePath: selected.sourcePath,
          approved,
          reviewNotes: notes,
          keepFilename,
          basenameOverride,
          relativePathOverride,
        });

        const nextSession = recordReviewSessionDecision(session ?? ensureReviewSession(stats ?? {
          todo: 0,
          admin: 0,
          later: 0,
          yes: 0,
          no: 0,
          flag: 0,
          total: 0,
          filingRules: 0,
          unprocessedInbox: 0,
          reviewScope: 0,
          projectDecided: 0,
          projectPercent: 0,
          decidedToday: 0,
        }), approved);

        if (BATCHED_FILTERS.includes(filter) && advance) {
          const remaining = queue.filter((item) => item.sourcePath !== selected.sourcePath);
          setQueue(remaining);
          setQueueShowing(remaining.length);
          setQueueTotal((prev) => Math.max(prev - 1, remaining.length));
          const nextStats = await fetchReviewStats();
          setStats(nextStats);
          syncMotivation(nextStats, nextSession);
          if (remaining.length === 0) {
            if (nextStats.todo > 0) {
              setStatusMessage(`Batch done — loading next ${REVIEW_BATCH} from backlog (${nextStats.todo} left).`);
              await loadFreshReviewBatch();
            }
            return;
          }
          const nextIndex = Math.min(selectedIndex, remaining.length - 1);
          const nextItem = remaining[nextIndex] ?? remaining[0]!;
          setSelectedPath(nextItem.sourcePath);
          setNotes(nextItem.reviewNotes ?? '');
          setKeepFilename(nextItem.keepFilename);
          setBasenameOverride(nextItem.basenameOverride);
          setRelativePathOverride(nextItem.relativePathOverride);
          return;
        }

        await refresh(filter, advance ? undefined : selected.sourcePath);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to save decision');
      } finally {
        setSaving(false);
      }
    },
    [basenameOverride, filter, keepFilename, loadFreshReviewBatch, notes, queue, refresh, relativePathOverride, selected, selectedIndex, session, syncMotivation]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inTextarea = target?.tagName === 'TEXTAREA';
      const inInput = target?.tagName === 'INPUT';
      const typing = inTextarea || inInput;

      if (event.key === 'Enter' && !event.shiftKey) {
        if (inTextarea && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          void selectRelative(1);
          return;
        }
        if (!typing) {
          event.preventDefault();
          void selectRelative(1);
          return;
        }
      }

      if (typing && !event.metaKey && !event.ctrlKey) return;

      if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault();
        selectRelative(1);
      } else if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault();
        selectRelative(-1);
      } else if (event.key === 'y' || event.key === 'Y') {
        event.preventDefault();
        void submitDecision('Y');
      } else if (event.key === 'n' || event.key === 'N') {
        event.preventDefault();
        void submitDecision('N');
      } else if (event.key === 'l' || event.key === 'L') {
        event.preventDefault();
        void submitDecision('L');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectRelative, submitDecision]);

  return (
    <div className={cn('flex flex-col bg-background text-foreground', className ?? 'h-screen')}>
      <header className="shrink-0 border-b border-border px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-base font-semibold leading-tight">DIL Review</h1>
            <p className="text-[11px] text-muted-foreground">
              Batch {REVIEW_BATCH} · Reload = registry only · Classify = OCR new inbox files
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {stats ? (
              <>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">To review: {stats.todo}</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">Noted: {stats.noted ?? 0}</span>
                <span className="rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  Admin: {stats.admin ?? 0}
                </span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">Later: {stats.later}</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">Yes: {stats.yes}</span>
              </>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={loading || saving || processing || !stats}
              onClick={() => {
                if (!stats) return;
                const nextSession = resetReviewSession(stats);
                syncMotivation(stats, nextSession);
              }}
            >
              New session
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={loading || saving || processing}
              onClick={() => void refresh(filter, selectedPath, { offset: batchOffset })}
            >
              Reload
            </Button>
            {filter === 'todo' ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                disabled={loading || saving || processing || queueTotal <= batchOffset + queueShowing}
                onClick={() => void loadNextReviewBatch()}
              >
                Next {REVIEW_BATCH}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              disabled={loading || saving || processing}
              onClick={() => void runClassifyBatch()}
            >
              {processing ? 'Classifying…' : `Classify ${REVIEW_BATCH}`}
            </Button>
            <Button
              size="sm"
              variant="default"
              className="h-7 px-2 text-xs"
              disabled={loading || saving || processing || applying}
              onClick={() => void runApplyApproved()}
              title="Runs dil:apply — dry-run preview first, then confirm to move/rename approved files for real"
            >
              {applying ? 'Applying…' : 'Apply approved ▶'}
            </Button>
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
          {stats && motivation ? (
            <p className="ml-auto text-[10px] text-muted-foreground">
              Session {motivation.sessionDecisions} ({motivation.sessionPercent}%) · Today {motivation.dayDecisions} ·
              Project {motivation.projectDecided}/{motivation.reviewScope} ({motivation.projectPercent}%)
            </p>
          ) : null}
        </div>
      </header>

      {error ? <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div> : null}
      {statusMessage ? (
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm text-muted-foreground">{statusMessage}</div>
      ) : null}

      {selected ? (
        <>
          <div className="shrink-0 border-b-2 border-primary/30 bg-primary/5 px-4 py-3">
            <div className="mx-auto w-full max-w-3xl">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="review-notes" className="text-sm font-semibold">
                  Notes — riff here first
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {notesSaveState === 'saving'
                    ? 'Saving…'
                    : notesSaveState === 'saved'
                      ? 'Saved'
                      : 'Autosaves on blur · Enter = next · Ctrl+Enter from notes'}
                </span>
              </div>
              <textarea
                id="review-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                onBlur={() => void autosaveNotes()}
                rows={4}
                placeholder={'Why yes/no/later. Shortcuts: "don\'t change", "archive", name: …, path: …'}
                className="mt-2 min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="shrink-0 border-b border-border bg-muted/25 px-4 py-2">
            <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button disabled={saving} variant="outline" size="sm" className="h-8" onClick={() => selectRelative(-1)}>
                  Prev
                </Button>
                <Button disabled={saving} variant="outline" size="sm" className="h-8" onClick={() => selectRelative(1)}>
                  Next (Enter)
                </Button>
                <Button
                  disabled={saving}
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => void submitDecision(selected.approved, false)}
                >
                  Save notes
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  disabled={saving}
                  size="sm"
                  className="h-8 bg-emerald-600 hover:bg-emerald-600/90"
                  onClick={() => void submitDecision('Y')}
                >
                  Approve (Y)
                </Button>
                <Button disabled={saving} variant="destructive" size="sm" className="h-8" onClick={() => void submitDecision('N')}>
                  Reject (N)
                </Button>
                <Button disabled={saving} variant="secondary" size="sm" className="h-8" onClick={() => void submitDecision('L')}>
                  Later (L)
                </Button>
              </div>
              <p className="w-full text-center text-[10px] text-muted-foreground sm:w-auto sm:text-right">
                {selectedIndex + 1} of {queue.length} · ↑/↓ j/k · Y/N/L
              </p>
            </div>
          </div>
        </>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="min-h-0 overflow-y-auto border-b border-border lg:border-b-0 lg:border-r">
          {filter === 'todo' && queueTotal > 0 ? (
            <p className="border-b border-border px-3 py-2 text-[11px] text-muted-foreground">
              Batch {Math.floor(batchOffset / REVIEW_BATCH) + 1}: {queueShowing} loaded · {queueTotal} in backlog · next batch auto-loads when this one is decided
            </p>
          ) : null}
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading queue…</p>
          ) : queue.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nothing in this queue.</p>
          ) : (
            <ul className="divide-y divide-border">
              {queue.map((item) => (
                <li key={item.sourcePath}>
                  <button
                    type="button"
                    onClick={() => void selectQueueItem(item.sourcePath)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-accent/50',
                      selectedPath === item.sourcePath && 'bg-accent'
                    )}
                  >
                    <div className="truncate font-medium">{item.currentFilename}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', approvalTone(item.approved))}>
                        {approvalLabel(item.approved)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{Math.round(item.confidence * 100)}%</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="min-h-0 border-b border-border lg:border-b-0 lg:border-r">
          {selected ? (
            <div className="flex h-full min-h-[320px] flex-col">
              <div className="border-b border-border px-4 py-2 text-sm">
                <div className="font-medium">{selected.currentFilename}</div>
                <div className="truncate text-xs text-muted-foreground">{selected.sourcePath}</div>
              </div>
              <div className="min-h-0 flex-1 bg-muted/20">
                {selected.previewKind === 'pdf' ? (
                  <iframe
                    title="Document preview"
                    src={filePreviewUrl(selected.sourcePath)}
                    className="h-full w-full border-0"
                  />
                ) : selected.previewKind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local file preview via API route
                  <img
                    src={filePreviewUrl(selected.sourcePath)}
                    alt={selected.currentFilename}
                    className="mx-auto h-full max-h-full w-auto object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
                    No inline preview for this file type. Use summary and path hints on the right.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              Select a document from the queue.
            </div>
          )}
        </section>

        <aside className="min-h-0 overflow-y-auto p-4">
          {selected ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold">{selected.displayTitle || 'Untitled'}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{selected.summary || 'No summary extracted.'}</p>
              </div>

              <div className="rounded-md border border-border bg-card p-3">
                <h3 className="text-xs font-semibold">Names (compare before you approve)</h3>
                <dl className="mt-2 space-y-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">On disk now</dt>
                    <dd className="break-all font-mono text-[11px]">{selected.currentFilename}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Registry (stage-1)</dt>
                    <dd className="break-all font-mono text-[11px] text-muted-foreground">
                      {selected.registryProposedBasename}
                      {selected.registryProposedBasename === selected.currentFilename ? (
                        <span className="ml-1 text-[10px]">— unchanged</span>
                      ) : (
                        <span className="ml-1 text-[10px]">— prior machine pass</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">v3 proposal (use this)</dt>
                    <dd className="break-all font-mono text-[11px] font-medium text-foreground">
                      {selected.proposedBasename}
                      {selected.v3AppliedRename ? (
                        <span className="ml-1 rounded bg-sky-500/15 px-1 py-0.5 text-[10px] font-medium text-sky-800 dark:text-sky-300">
                          refreshed
                        </span>
                      ) : v3Extraction?.proposal ? (
                        <span className="ml-1 text-[10px] text-muted-foreground">— same as registry</span>
                      ) : v3Extraction ? (
                        <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-400">
                          — piloted, needs human ({v3Extraction.chars} chars OCR)
                        </span>
                      ) : (
                        <span className="ml-1 text-[10px] text-amber-700 dark:text-amber-400">— not in pilot batch yet</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Target path</dt>
                    <dd className="break-all font-mono text-[11px]">{selected.proposedRelativePath}</dd>
                  </div>
                  {selected.hasDraftIntent ? (
                    <div>
                      <dt className="font-medium text-foreground">
                        Your riff (draft)
                        <span className="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
                          saved — press Y to lock
                        </span>
                      </dt>
                      <dd className="break-all font-mono text-[11px] font-medium text-foreground">
                        {selected.effectiveBasename}
                      </dd>
                      <dd className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                        {selected.effectiveRelativePath}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="font-medium">{selected.docRole}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Bucket</dt>
                  <dd className="font-medium">{selected.proposedBucket}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Confidence</dt>
                  <dd className="font-medium">
                    {Math.round(selected.confidence * 100)}% · naming {Math.round(selected.namingConfidence * 100)}%
                  </dd>
                </div>
              </dl>

              {selected.warnings.length > 0 ? (
                <div>
                  <h3 className="text-xs font-semibold text-amber-700 dark:text-amber-400">Warnings</h3>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {selected.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-md border border-border/80 bg-muted/20 p-3">
                <h3 className="text-xs font-semibold">v3 extraction (pilot)</h3>
                {v3Loading ? (
                  <p className="mt-1 text-xs text-muted-foreground">Loading pilot evidence…</p>
                ) : v3Extraction ? (
                  <div className="mt-2 space-y-2 text-xs">
                    {v3Extraction.originalBasename || v3Extraction.registryBasename ? (
                      <dl className="space-y-1 rounded bg-muted/40 p-2">
                        {v3Extraction.originalBasename ? (
                          <div>
                            <dt className="text-muted-foreground">Pilot saw on disk</dt>
                            <dd className="font-mono text-[10px]">{v3Extraction.originalBasename}</dd>
                          </div>
                        ) : null}
                        {v3Extraction.registryBasename ? (
                          <div>
                            <dt className="text-muted-foreground">Registry at pilot time</dt>
                            <dd className="font-mono text-[10px]">{v3Extraction.registryBasename}</dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}
                    {v3Extraction.proposal ? (
                      <p>
                        <span className="text-muted-foreground">Proposed: </span>
                        <span className="break-all font-mono text-[11px]">{v3Extraction.proposal}</span>
                      </p>
                    ) : (
                      <p className="text-amber-700 dark:text-amber-400">Needs human — no fully-validated proposal.</p>
                    )}
                    <p className="text-muted-foreground">
                      {v3Extraction.method} · {v3Extraction.chars} chars
                      {v3Extraction.runAt ? ` · run ${v3Extraction.runAt}` : null}
                    </p>
                    {Object.entries(v3Extraction.fields).length > 0 ? (
                      <dl className="space-y-1">
                        {Object.entries(v3Extraction.fields).map(([key, field]) => (
                          <div key={key}>
                            <dt className="font-medium capitalize text-foreground">{key.replace(/_/g, ' ')}</dt>
                            <dd className="text-muted-foreground">
                              {field.value}
                              {field.page ? ` (p${field.page})` : null}
                              {field.evidence ? (
                                <span className="block font-mono text-[10px] text-muted-foreground/90">
                                  “{field.evidence.slice(0, 120)}
                                  {field.evidence.length > 120 ? '…' : ''}”
                                </span>
                              ) : null}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    {v3Extraction.notes.length > 0 ? (
                      <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                        {v3Extraction.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No pilot row for this file yet. Re-run{' '}
                    <span className="font-mono">pilot_extract_v3.py</span> (pre-admin scope) to populate{' '}
                    <span className="font-mono">pilot-v3-results.jsonl</span>.
                  </p>
                )}
              </div>

              {selected.hasLearnedRule ? (
                <p className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-800 dark:text-emerald-400">
                  Learned filing rule
                  {selected.learnedRuleLabel ? (
                    <>
                      {' '}
                      — <span className="font-medium">{selected.learnedRuleLabel}</span>
                    </>
                  ) : null}
                  . Similar receipts with the same vendor or org should get this folder.
                </p>
              ) : null}

              <div className="space-y-3 rounded-md border border-border p-3">
                <h3 className="text-xs font-semibold">Filing override (optional)</h3>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={keepFilename}
                    onChange={(event) => setKeepFilename(event.target.checked)}
                    className="rounded border-input"
                  />
                  Keep current filename
                </label>
                <div>
                  <label htmlFor="basename-override" className="text-xs text-muted-foreground">
                    Target name (optional)
                  </label>
                  <input
                    id="basename-override"
                    value={basenameOverride}
                    onChange={(event) => setBasenameOverride(event.target.value)}
                    placeholder="e.g. 070101_Biometric-Headshot_Williams-Logan.pdf"
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label htmlFor="path-override" className="text-xs text-muted-foreground">
                    Target path (optional)
                  </label>
                  <PathAutocompleteInput
                    key={selected.sourcePath}
                    id="path-override"
                    value={relativePathOverride}
                    onChange={setRelativePathOverride}
                    placeholder="e.g. C:\\DATA\\20_ADMIN or 90_ARCHIVE\\filename.pdf"
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                {filingPreview ? (
                  <div className="rounded-md bg-muted/50 p-2 text-[11px]">
                    <div className="font-semibold">
                      Will apply as (if you Approve)
                      {selected.hasDraftIntent ? (
                        <span className="ml-1 font-normal text-muted-foreground">— draft intent from notes</span>
                      ) : null}
                    </div>
                    <div className="mt-1 break-all font-mono">{filingPreview.relativePath}</div>
                    {filingPreview.usedOverride ? (
                      <div className="mt-1 text-muted-foreground">Overrides machine proposal</div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Approve / Reject / Later</p>
                <p className="mt-1">
                  Buttons are above the preview. Approve uses <em>Will apply as</em> below. Nothing moves until{' '}
                  <code className="text-[10px]">Apply approved</code>.
                </p>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
