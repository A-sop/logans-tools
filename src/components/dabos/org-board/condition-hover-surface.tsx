import Link from 'next/link';
import type { ReactNode } from 'react';

import { conditionDataAttr, conditionHoverLabel } from '@/lib/dabos/condition-display';
import type { BoardStatSnapshot } from '@/lib/dabos/condition-display';
import type { ConditionLabel } from '@/lib/dabos/types';

import './org-board.css';

type ConditionHoverSurfaceProps = {
  condition: ConditionLabel | null;
  stat?: BoardStatSnapshot | null;
  statIndicated?: ConditionLabel | null;
  climbLag?: boolean;
  className?: string;
  children: ReactNode;
  href?: string;
  /** Native tooltip (e.g. ESTO Round 1 status on dept cells). */
  title?: string;
};

export function ConditionHoverSurface({
  condition,
  stat,
  statIndicated,
  climbLag,
  className = '',
  children,
  href,
  title,
}: ConditionHoverSurfaceProps) {
  const label = conditionHoverLabel(condition, stat, { statIndicated, climbLag });
  const dataCondition = conditionDataAttr(condition);
  const classes = ['dabos-org-board__condition-hover', className].filter(Boolean).join(' ');

  const inner = (
    <>
      <span className="dabos-org-board__condition-hover-default">{children}</span>
      <span className="dabos-org-board__condition-hover-label">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        data-condition={dataCondition}
        aria-label={`${label} condition`}
        title={title}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className={classes} data-condition={dataCondition} title={title}>
      {inner}
    </div>
  );
}
