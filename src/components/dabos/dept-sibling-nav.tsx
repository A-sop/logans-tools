'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { dabosDeptHref, type BrowseDept } from '@/lib/dabos/dabos-paths';
import { deptNumberLabel, deptRoleLabel } from '@/lib/dabos/org-board-config';
import { cn } from '@/lib/utils';

export type DeptSibling = {
  id: string;
  legacy_name: string;
  operational_name: string;
};

type DeptSiblingNavProps = {
  divisionId: string;
  currentDeptId: string;
  siblings: DeptSibling[];
  browse: {
    index: number;
    total: number;
    prev: BrowseDept | null;
    next: BrowseDept | null;
  };
};

function neighborLabel(dept: BrowseDept, currentDivisionId: string): string {
  const role = deptRoleLabel(dept);
  if (dept.division_id !== currentDivisionId) {
    return `${dept.division_id} · ${deptNumberLabel(dept.id, { short: true })} — ${role}`;
  }
  return `${deptNumberLabel(dept.id, { short: true })} — ${role}`;
}

export function DeptSiblingNav({
  divisionId,
  currentDeptId,
  siblings,
  browse,
}: DeptSiblingNavProps) {
  const router = useRouter();
  const { prev, next, index, total } = browse;
  const current = siblings.find((d) => d.id === currentDeptId) ?? null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowLeft' && prev) {
        e.preventDefault();
        router.push(dabosDeptHref(prev.id));
      }
      if (e.key === 'ArrowRight' && next) {
        e.preventDefault();
        router.push(dabosDeptHref(next.id));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, router]);

  if (total < 2) return null;

  return (
    <section
      className="mb-6 rounded-lg border border-border bg-muted/20 p-3"
      aria-label="Department navigator"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Departments · continues across divisions
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {index >= 0 ? index + 1 : '—'} / {total}
          <span className="ml-2 hidden sm:inline">← → keys</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        {prev ? (
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <Link href={dabosDeptHref(prev.id)} aria-label={`Previous: ${neighborLabel(prev, divisionId)}`}>
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
                {deptNumberLabel(current.id)} — {deptRoleLabel(current)}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {divisionId} · {current.legacy_name}
              </p>
            </>
          ) : null}
        </div>

        {next ? (
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <Link href={dabosDeptHref(next.id)} aria-label={`Next: ${neighborLabel(next, divisionId)}`}>
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
        {siblings.map((dept) => {
          const active = dept.id === currentDeptId;
          return (
            <Link
              key={dept.id}
              href={dabosDeptHref(dept.id)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              {deptNumberLabel(dept.id, { short: true })}
            </Link>
          );
        })}
      </div>

      {(prev || next) && (
        <div className="mt-2 flex justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{prev ? `← ${neighborLabel(prev, divisionId)}` : ''}</span>
          <span className="truncate text-right">{next ? `${neighborLabel(next, divisionId)} →` : ''}</span>
        </div>
      )}
    </section>
  );
}
