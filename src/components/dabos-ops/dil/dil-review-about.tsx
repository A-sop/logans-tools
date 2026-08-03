'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type DilReviewAboutProps = {
  className?: string;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function Term({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <dt className="text-sm font-semibold text-foreground">{name}</dt>
      <dd className="mt-1 text-sm text-muted-foreground">{children}</dd>
    </div>
  );
}

export function DilReviewAbout({ className }: DilReviewAboutProps) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto bg-background', className)}>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">About this workbench</h1>
          <p className="text-sm text-muted-foreground">
            Human review queue for Logan&apos;s local file estate and Chrome bookmarks. Nothing moves on
            disk until you explicitly approve it (files) or delete from Chrome (bookmarks).
          </p>
          <p className="text-xs text-muted-foreground">
            Launch: desktop shortcut <strong className="font-medium text-foreground">DIL Review</strong>{' '}
            or <code className="rounded bg-muted px-1 py-0.5">npm run dil:review</code> →{' '}
            <code className="rounded bg-muted px-1 py-0.5">http://localhost:3847/dil/review</code>
          </p>
        </header>

        <Section title="Acronyms & names">
          <dl className="space-y-2">
            <Term name="DIL — Document Intake & Lifecycle">
              The project that sorts, triages, renames, and extracts tasks from files under{' '}
              <code className="rounded bg-muted px-1">C:\DATA</code>. This UI is the review face of
              DIL: you confirm proposals before anything is renamed or moved.
            </Term>
            <Term name="DEPP — Get Your Ship Together">
              Logan&apos;s personal digital-cleanup program (daily habit, not this app itself). DEPP is
              the <em>why</em> — steady inbox drain and triage. DIL is the <em>how</em> — registry,
              batches, and this workbench. Daily loop: capture → review here → apply when ready. See{' '}
              <code className="rounded bg-muted px-1">Atlas/docs/admin/daily-triage.md</code>.
            </Term>
            <Term name="DABOS">
              Logan OS — the operating system for divisions, ventures, delivery, and governance (21
              departments, stats, tasks, wiki). DIL feeds DABOS with file-derived tasks and curated
              bookmarks; it does not replace Dept1 live capture (Telegram, wiki inbox, YouTube likes).
            </Term>
            <Term name="LDW">
              Logan Williams — founder / policy owner for this stack.
            </Term>
            <Term name="GFP">
              German Financial Planning — the financial-advice venture on top of DABOS.
            </Term>
          </dl>
        </Section>

        <Section title="Files mode — how to use">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Pick a filter: <strong className="font-medium text-foreground">To review</strong> (main
              queue), <strong className="font-medium text-foreground">Noted</strong> (you riffed but
              haven&apos;t decided), <strong className="font-medium text-foreground">Admin</strong>{' '}
              (2026 tax docs), <strong className="font-medium text-foreground">Later</strong>, or{' '}
              <strong className="font-medium text-foreground">Decided</strong>.
            </li>
            <li>
              Select a file in the queue. Preview in the center panel; v3 extraction (when available)
              shows on the right.
            </li>
            <li>
              <strong className="font-medium text-foreground">Notes</strong> (top bar): riff intent —
              destination, rename, tasks. Autosaves on blur. Custom notes move the row to{' '}
              <strong className="font-medium text-foreground">Noted</strong> and teach draft filing
              rules.
            </li>
            <li>
              <strong className="font-medium text-foreground">Y</strong> = approve proposal ·{' '}
              <strong className="font-medium text-foreground">N</strong> = reject ·{' '}
              <strong className="font-medium text-foreground">L</strong> = later ·{' '}
              <strong className="font-medium text-foreground">↑/↓</strong> or j/k = prev/next.
            </li>
            <li>
              When enough rows are <strong className="font-medium text-foreground">Y</strong>, run{' '}
              <strong className="font-medium text-foreground">Apply approved</strong> — dry-run first,
              then execute. Every move is logged and reversible.
            </li>
          </ol>
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            <strong className="text-foreground">Safety:</strong> client folders, most of{' '}
            <code className="rounded bg-muted px-0.5">20_ADMIN</code>, and tax master workbooks are
            frozen or human-only. Agents never bulk-move without your batch confirm.
          </p>
        </Section>

        <Section title="Bookmarks mode — how to use">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Oldest bookmarks first — prune legacy noise, keep a curated research corpus for agents.
            </li>
            <li>
              Three columns: queue · iframe preview · details. Many sites block embedding; use{' '}
              <strong className="font-medium text-foreground">Open in browser</strong> when preview is
              blank.
            </li>
            <li>
              <strong className="font-medium text-foreground">Keep (Y)</strong> — stays in Chrome +
              promoted in the index (agents search here first).
            </li>
            <li>
              <strong className="font-medium text-foreground">Delete (N)</strong> — removes from Chrome
              JSON (backup saved) + archives in index. <em>Quit Chrome completely first</em> (banner at
              top).
            </li>
            <li>
              <strong className="font-medium text-foreground">Notes</strong> on blur →{' '}
              <strong className="font-medium text-foreground">Noted</strong> tab until you Keep or
              Delete (e.g. &quot;potential GFP content&quot;). No separate Later outcome.
            </li>
            <li>Link status auto-checks on select; recheck manually if needed.</li>
          </ol>
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            Agent query for kept bookmarks:{' '}
            <code className="rounded bg-muted px-0.5">
              npx tsx scripts/contact-network/query-unified-tasks.ts --source bookmark --triage promoted
            </code>
          </p>
        </Section>

        <Section title="Keyboard shortcuts (both modes)">
          <ul className="grid gap-2 sm:grid-cols-2">
            <li className="rounded-md border border-border px-3 py-2 text-sm">
              <kbd className="font-mono text-xs">Y</kbd> — Keep / Yes
            </li>
            <li className="rounded-md border border-border px-3 py-2 text-sm">
              <kbd className="font-mono text-xs">N</kbd> — Delete / No
            </li>
            <li className="rounded-md border border-border px-3 py-2 text-sm">
              <kbd className="font-mono text-xs">J</kbd> / <kbd className="font-mono text-xs">↓</kbd>{' '}
              — Next item
            </li>
            <li className="rounded-md border border-border px-3 py-2 text-sm">
              <kbd className="font-mono text-xs">K</kbd> / <kbd className="font-mono text-xs">↑</kbd>{' '}
              — Previous item
            </li>
            <li className="rounded-md border border-border px-3 py-2 text-sm sm:col-span-2">
              <kbd className="font-mono text-xs">Enter</kbd> in notes — next item (bookmarks + files)
            </li>
          </ul>
          <p className="text-xs">
            Files mode also supports <kbd className="rounded bg-muted px-1 font-mono text-xs">L</kbd>{' '}
            for Later. Shortcuts are ignored while typing in inputs unless noted above.
          </p>
        </Section>

        <Section title="Where to read more">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>
              DIL project README: <code className="rounded bg-muted px-1">C:\DATA\30_PROJECTS\DIL\README.md</code>
            </li>
            <li>
              Handoff cheat sheet:{' '}
              <code className="rounded bg-muted px-1">
                Atlas/docs/document-organisation/dil-learn-on-noted-handoff.md
              </code>
            </li>
            <li>
              Curated bookmarks corpus:{' '}
              <code className="rounded bg-muted px-1">Atlas/docs/reference/curated-bookmarks-agent-corpus.md</code>
            </li>
            <li>
              DEPP daily habit: <code className="rounded bg-muted px-1">Atlas/docs/admin/daily-triage.md</code>
            </li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
