'use client';

import * as React from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LikeToggleButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onToggle'> {
  count: number;
  isLiked?: boolean;
  onToggle?: (_liked: boolean) => void;
}

/**
 * Like/heart toggle button matching togglebutton1 design:
 * - Unselected: outlined heart, lavender border, transparent bg
 * - Selected: filled heart, solid purple bg, white text
 */
export function LikeToggleButton({
  count,
  isLiked = false,
  onToggle,
  className,
  ...props
}: LikeToggleButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onToggle?.(!isLiked);
    props.onClick?.(e);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLiked}
      aria-label={isLiked ? 'Unlike' : 'Like'}
      onClick={handleClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        isLiked
          ? 'border-transparent bg-[#7c5ac2] text-white'
          : 'border border-[#b8a9d4] bg-transparent text-[#8b7aa8] hover:border-[#9b8bc4]',
        className
      )}
      {...props}
    >
      <span className="tabular-nums">{count}</span>
      <Heart
        className={cn('h-4 w-4', isLiked ? 'fill-current' : 'stroke-current')}
        strokeWidth={isLiked ? 0 : 2}
      />
    </button>
  );
}
