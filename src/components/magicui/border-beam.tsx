'use client';

import { cn } from '@/lib/utils';

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

export function BorderBeam({
  className,
  size = 50,
  duration = 6,
  borderWidth = 1.5,
  colorFrom = '#ffaa40',
  colorTo = '#9c40ff',
  delay = 0,
}: BorderBeamProps) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 rounded-[inherit]', className)}
      style={{
        background: `linear-gradient(${colorFrom}, ${colorTo})`,
        backgroundSize: `${size * 2}px ${size * 2}px`,
        animation: `border-beam ${duration}s linear infinite`,
        animationDelay: `${delay}s`,
        opacity: 0.6,
        borderWidth: `${borderWidth}px`,
        borderStyle: 'solid',
        borderImage: `linear-gradient(${colorFrom}, ${colorTo}) 1`,
        maskImage: `radial-gradient(circle at center, transparent 0%, black ${size}px)`,
        WebkitMaskImage: `radial-gradient(circle at center, transparent 0%, black ${size}px)`,
      }}
    />
  );
}
