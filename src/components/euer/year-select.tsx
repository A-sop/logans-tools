'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function YearSelect({ years, currentYear }: { years: number[]; currentYear: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <select
      className="h-9 rounded-md border border-input bg-card px-3 text-sm shadow-sm"
      value={currentYear}
      onChange={(e) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('year', e.target.value);
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );
}
