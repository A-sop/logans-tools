import type { DeptEstablishment } from '@/lib/dabos/establishment';
import { cn } from '@/lib/utils';

const FLAGS = [
  { key: 'hat_confirmed', label: 'hat', title: 'Hat card confirmed' },
  { key: 'stat_defined', label: 'stat', title: 'Stat key defined' },
  { key: 'comm_line_named', label: 'comm', title: 'Primary comm line named' },
  { key: 'first_output_named', label: 'first', title: 'First output named' },
] as const;

function formatValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

/** Four establishment boxes as compact badges (drilldown surfaces). */
export function EstablishmentFlags({
  establishment,
  className,
}: {
  establishment: DeptEstablishment | null | undefined;
  className?: string;
}) {
  if (!establishment) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        establishment not seeded
      </span>
    );
  }
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {FLAGS.map(({ key, label, title }) => {
        const ok = establishment[key];
        return (
          <span
            key={key}
            title={`${title}: ${ok ? 'yes' : 'no'}`}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none',
              ok
                ? 'border-border text-foreground'
                : 'border-dashed border-destructive/60 bg-destructive/5 text-destructive'
            )}
          >
            {label}
            <span aria-hidden>{ok ? '\u2713' : '\u2717'}</span>
          </span>
        );
      })}
    </span>
  );
}

/** Stat status line: reported number, or the to-report pointer string. */
export function EstablishmentStatLine({
  establishment,
  className,
}: {
  establishment: DeptEstablishment | null | undefined;
  className?: string;
}) {
  if (!establishment) return null;
  const reported =
    establishment.stat_status === 'reported' && establishment.stat_value != null;
  if (reported) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        <span className="font-semibold tabular-nums text-foreground">
          {formatValue(establishment.stat_value!)}
        </span>{' '}
        {establishment.stat_metric_key}
      </span>
    );
  }
  return (
    <span className={cn('text-xs italic text-muted-foreground', className)}>
      to report {'\u2192'} {establishment.stat_pointer}
    </span>
  );
}
