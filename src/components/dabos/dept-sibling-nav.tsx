'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
};

export function DeptSiblingNav({
  divisionId,
  currentDeptId,
  siblings,
}: DeptSiblingNavProps) {
  const router = useRouter();
  const index = siblings.findIndex((d) => d.id === currentDeptId);
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;
  const current = index >= 0 ? siblings[index] : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowLeft' && prev) {
        e.preventDefault();
        router.push(`/dabos/divisions/${divisionId}/dept/${prev.id}`);
      }
      if (e.key === 'ArrowRight' && next) {
        e.preventDefault();
        router.push(`/dabos/divisions/${divisionId}/dept/${next.id}`);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [divisionId, next, prev, router]);

  if (siblings.length < 2) return null;

  return (
    <section
      className="mb-6 rounded-lg border border-border bg-muted/20 p-3"
      aria-label="Department navigator"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Departments in this division
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {index >= 0 ? index + 1 : '—'} / {siblings.length}
          <span className="ml-2 hidden sm:inline">← → keys</span>
        </p>
      </div>

      <div className="flex items-center gap-2">
        {prev ? (
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <Link
              href={`/dabos/divisions/${divisionId}/dept/${prev.id}`}
              aria-label={`Previous: ${deptRoleLabel(prev)}`}
            >
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
              <p className="truncate text-xs text-muted-foreground">{current.legacy_name}</p>
            </>
          ) : null}
        </div>

        {next ? (
          <Button variant="outline" size="icon" asChild className="shrink-0">
            <Link
              href={`/dabos/divisions/${divisionId}/dept/${next.id}`}
              aria-label={`Next: ${deptRoleLabel(next)}`}
            >
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
              href={`/dabos/divisions/${divisionId}/dept/${dept.id}`}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              {deptNumberLabel(dept.id)}
            </Link>
          );
        })}
      </div>

      {(prev || next) && (
        <div className="mt-2 flex justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">{prev ? `← ${deptRoleLabel(prev)}` : ''}</span>
          <span className="truncate text-right">{next ? `${deptRoleLabel(next)} →` : ''}</span>
        </div>
      )}
    </section>
  );
}
