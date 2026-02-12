'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  value?: Date | null;
  onChange?: (_date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  /** Dark theme variant matching date-picker design */
  variant?: 'default' | 'dark';
}

/**
 * Date picker matching date-picker design (dd/mm/yyyy input + Clear/Today).
 * Uses native date input for reliability; calendar UI can be enhanced with react-day-picker when installed.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  className,
  variant = 'default',
}: DatePickerProps) {
  const isoValue = value ? value.toISOString().slice(0, 10) : '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (!v) {
      onChange?.(undefined);
      return;
    }
    const d = new Date(v);
    if (!isNaN(d.getTime())) onChange?.(d);
  };

  const handleClear = () => onChange?.(undefined);

  const handleToday = () => onChange?.(new Date());

  const isDark = variant === 'dark';

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-3',
        isDark
          ? 'border-[#2a2d35] bg-[#1a1d24] text-gray-200'
          : 'border-border bg-background',
        className
      )}
    >
      <Input
        type="date"
        value={isoValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(
          'w-full',
          isDark &&
            'border-[#3d4350] bg-[#0f1116] text-gray-200 [color-scheme:dark] focus-visible:ring-[#5b9bd5] focus-visible:border-[#5b9bd5]'
        )}
      />
      <div className="flex justify-between text-sm">
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            'hover:underline',
            isDark ? 'text-[#5b9bd5]' : 'text-primary'
          )}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleToday}
          className={cn(
            'hover:underline',
            isDark ? 'text-[#5b9bd5]' : 'text-primary'
          )}
        >
          Today
        </button>
      </div>
    </div>
  );
}
