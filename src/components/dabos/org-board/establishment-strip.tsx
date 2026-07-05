import type { DeptEstablishment } from '@/lib/dabos/establishment';

import './org-board.css';

const ESTABLISHMENT_BOXES = [
  { key: 'hat_confirmed', label: 'HAT', title: 'Hat card confirmed' },
  { key: 'stat_defined', label: 'STAT', title: 'Stat key defined' },
  { key: 'comm_line_named', label: 'COMM', title: 'Primary comm line named' },
  { key: 'first_output_named', label: '1ST', title: 'First output named' },
] as const;

function formatValue(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

/**
 * Four establishment boxes (hat/stat/comm/first) + stat status per department.
 * Stat shows the reported number, or the to-report pointer string — never blank.
 */
export function EstablishmentStrip({
  establishment,
}: {
  establishment: DeptEstablishment | null | undefined;
}) {
  if (!establishment) {
    return (
      <div className="dabos-org-board__estab">
        <span className="dabos-org-board__estab-pointer">establishment not seeded</span>
      </div>
    );
  }

  const reported =
    establishment.stat_status === 'reported' && establishment.stat_value != null;

  return (
    <div className="dabos-org-board__estab">
      <div className="dabos-org-board__estab-boxes" aria-label="Establishment checklist">
        {ESTABLISHMENT_BOXES.map(({ key, label, title }) => {
          const ok = establishment[key];
          return (
            <span
              key={key}
              className={`dabos-org-board__estab-box${ok ? ' dabos-org-board__estab-box--ok' : ' dabos-org-board__estab-box--gap'}`}
              title={`${title}: ${ok ? 'yes' : 'no'}`}
            >
              <span className="dabos-org-board__estab-box-label">{label}</span>
              <span className="dabos-org-board__estab-box-mark">{ok ? '\u2713' : '\u2717'}</span>
            </span>
          );
        })}
      </div>
      {reported ? (
        <div
          className="dabos-org-board__estab-stat"
          title={`Reported stat: ${establishment.stat_metric_key}`}
        >
          <span className="dabos-org-board__estab-stat-value">
            {formatValue(establishment.stat_value!)}
          </span>
          <span className="dabos-org-board__estab-stat-key">
            {establishment.stat_metric_key}
          </span>
        </div>
      ) : (
        <div
          className="dabos-org-board__estab-stat"
          title={`To report — pointer: ${establishment.stat_pointer ?? ''}`}
        >
          <span className="dabos-org-board__estab-pointer">
            {'\u2192'} {establishment.stat_pointer}
          </span>
        </div>
      )}
    </div>
  );
}
