'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  BOARD_DIVISION_ORDER,
  DIVISION_BAND_TITLE,
  type BoardDivisionId,
  divisionSecretaryLabel,
} from '@/lib/dabos/org-board-config';
import { cn } from '@/lib/utils';

export type DivSibling = {
  id: string;
  operational_name: string;
};

type DivSiblingNavProps = {
  currentDivisionId: string;
  siblings: DivSibling[];
};

function orderDivisions(siblings: DivSibling[]): DivSibling[] {
  const byId = new Map(siblings.map((d) => [d.id, d]));
  const ordered: DivSibling[] = [];
  for (const id of BOARD_DIVISION_ORDER) {
    const row = byId.get(id);
    if (row) ordered.push(row);
  }
  for (const row of siblings) {
    if (!ordered.some((d) => d.id === row.id)) ordered.push(row);
  }
  return ordered;
}

function bandTitle(id: string): string {
  return DIVISION_BAND_TITLE[id as BoardDivisionId] ?? id;
}

export function DivSiblingNav({ currentDivisionId, siblings }: DivSiblingNavProps) {
  const router = useRouter();
  const ordered = useMemo(() => orderDivisions(siblings), [siblings]);
  const index = ordered.findIndex((d) => d.id === currentDivisionId);
  const prev = index > 0 ? ordered[index - 1] : null;
  const next = index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null;
  const current = index >= 0 ? ordered[index] : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowLeft' && prev) {
        e.preventDefault();
        router.push(`/dabos/divisions/${prev.id}`);
      }
      if (e.key === 'ArrowRight' && next) {
        e.preventDefault();
        router.push(`/dabos/divisions/${next.id}`);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, router]);

  if (ordered.length < 2) return null;

  return (
    <section
      className="mb-6 rounded-lg border border-border bg-muted/20 p-3"
      aria-label="Division navigator"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Divisions
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {index >= 0 ? index + 1 : '—'} / {ordered.length}
          <span className="ml-2 hidden sm:inline">← → keys</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        {prev ? (
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <Link href={`/dabos/divisions/${prev.id}`} aria-label={`Previous: ${prev.id}`}>
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" disabled className="shrink-0" aria-hidden>
            <ChevronLeft className="size-4" />
          </Button>
        )}

        <div className="min-w-0 flex-1 text-center">
          {current ? (
            <>
              <p className="truncate text-sm font-semibold">
                {current.id} — {bandTitle(current.id)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {divisionSecretaryLabel(current.operational_name)}
              </p>
            </>
          ) : null}
        </div>

        {next ? (
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <Link href={`/dabos/divisions/${next.id}`} aria-label={`Next: ${next.id}`}>
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" disabled className="shrink-0" aria-hidden>
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {ordered.map((div) => {
          const active = div.id === currentDivisionId;
          return (
            <Link
              key={div.id}
              href={`/dabos/divisions/${div.id}`}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              {div.id}
            </Link>
          );
        })}
      </div>

      {(prev || next) && (
        <div className="mt-2 flex justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{prev ? `← ${prev.id}` : ''}</span>
          <span className="truncate text-right">{next ? `${next.id} →` : ''}</span>
        </div>
      )}
    </section>
  );
}
