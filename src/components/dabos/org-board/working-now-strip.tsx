import Link from 'next/link';

import { ActivityBadge } from '@/components/dabos/condition-badge';
import { deptNumberLabel } from '@/lib/dabos/org-board-config';
import type { WorkingNowEntry } from '@/lib/dabos/server-data';

function workingKindLabel(entry: WorkingNowEntry): string {
  if (entry.sample_assigned_agent) return entry.sample_assigned_agent;
  if (entry.sample_type === 'agent') return 'agent';
  if (entry.sample_type === 'human') return 'human';
  return 'in progress';
}

export function WorkingNowStrip({
  workingNow,
}: {
  workingNow: WorkingNowEntry[];
}) {
  if (workingNow.length === 0) {
    return (
      <div
        className="dabos-org-board__working-now dabos-org-board__working-now--empty"
        aria-label="Departments working now"
      >
        <span className="dabos-org-board__working-now-label">Working now</span>
        <span className="dabos-org-board__working-now-empty-text">
          No departments executing — purple dots appear when a task is <code>doing</code>
        </span>
      </div>
    );
  }

  return (
    <div className="dabos-org-board__working-now" aria-label="Departments working now">
      <div className="dabos-org-board__working-now-head">
        <ActivityBadge activity="investigating" />
        <span className="dabos-org-board__working-now-label">
          Working now · {workingNow.length} department
          {workingNow.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul className="dabos-org-board__working-now-list">
        {workingNow.map((entry) => {
          const deptHref = `/dabos/divisions/${entry.division_id}/dept/${entry.department_id}`;
          const taskHref = entry.sample_task_id
            ? `/dabos/tasks/${entry.sample_task_id}`
            : deptHref;
          return (
            <li key={entry.department_id} className="dabos-org-board__working-now-item">
              <Link href={deptHref} className="dabos-org-board__working-now-dept">
                <span className="dabos-org-board__dept-dot dabos-org-board__dept-dot--investigating" />
                {deptNumberLabel(entry.department_id, { short: true })}
                <span className="dabos-org-board__working-now-name">
                  {entry.operational_name}
                </span>
                {entry.doing_count > 1 ? (
                  <span className="dabos-org-board__working-now-count">
                    ×{entry.doing_count}
                  </span>
                ) : null}
              </Link>
              {entry.sample_title ? (
                <Link href={taskHref} className="dabos-org-board__working-now-task">
                  <span className="dabos-org-board__working-now-kind">
                    {workingKindLabel(entry)}
                  </span>
                  {entry.sample_title}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
