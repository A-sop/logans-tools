import Link from 'next/link';
import type { ReactNode } from 'react';

import { conditionDataAttr, conditionHoverLabel } from '@/lib/dabos/condition-display';
import type { BoardStatSnapshot } from '@/lib/dabos/condition-display';
import type { ConditionLabel } from '@/lib/dabos/types';

import './org-board.css';

type ConditionHoverSurfaceProps = {
  condition: ConditionLabel | null;
  stat?: BoardStatSnapshot | null;
  className?: string;
  children: ReactNode;
  href?: string;
};

export function ConditionHoverSurface({
  condition,
  stat,
  className = '',
  children,
  href,
}: ConditionHoverSurfaceProps) {
  const label = conditionHoverLabel(condition, stat);
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
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className={classes} data-condition={dataCondition}>
      {inner}
    </div>
  );
}
