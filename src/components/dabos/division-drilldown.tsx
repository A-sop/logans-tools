import type { ReactNode } from 'react';

import Link from 'next/link';

import { ConditionBadge } from '@/components/dabos/condition-badge';
import { ActivityBadge } from '@/components/dabos/condition-badge';
import {
  EstablishmentFlags,
  EstablishmentStatLine,
} from '@/components/dabos/establishment-badges';
import type { DeptEstablishment } from '@/lib/dabos/establishment';
import { deptRoleLabel, divisionSecretaryLabel } from '@/lib/dabos/org-board-config';
import type { ConditionLabel } from '@/lib/dabos/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type DeptSummary = {
  id: string;
  legacy_name: string;
  operational_name: string;
  condition: ConditionLabel | null;
  open_task_count?: number;
  activity?: 'active' | 'idle' | 'investigating';
  establishment?: DeptEstablishment | null;
};

type DivisionDrilldownHeaderProps = {
  divisionId: string;
  operationalName: string;
  description: string | null;
  condition: ConditionLabel | null;
  metricKey: string;
  departments: DeptSummary[];
};

export function DivisionDrilldownHeader({
  divisionId,
  operationalName,
  description,
  condition,
  metricKey,
  departments,
}: DivisionDrilldownHeaderProps) {
  return (
    <header className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {divisionSecretaryLabel(operationalName)}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{operationalName}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <ConditionBadge condition={condition} />
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {metricKey}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => (
          <Link key={dept.id} href={`/dabos/divisions/${divisionId}/dept/${dept.id}`}>
            <Card className="h-full transition-colors hover:bg-muted/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold leading-snug">
                  {dept.id} — {deptRoleLabel(dept)}
                </CardTitle>
                <CardDescription>{dept.legacy_name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ConditionBadge condition={dept.condition} />
                  {dept.activity ? <ActivityBadge activity={dept.activity} /> : null}
                  {(dept.open_task_count ?? 0) > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {dept.open_task_count} open
                    </span>
                  ) : null}
                </div>
                <EstablishmentFlags establishment={dept.establishment} />
                <div>
                  <EstablishmentStatLine establishment={dept.establishment} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </header>
  );
}

export function DrilldownShell({
  backHref,
  backLabel,
  children,
  className,
}: {
  backHref: string;
  backLabel: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('dabos-drilldown w-full font-sans', className)}>
      <Link
        href={backHref}
        className="mb-4 inline-block text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        ← {backLabel}
      </Link>
      {children}
    </div>
  );
}
