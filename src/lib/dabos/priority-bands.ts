/** Bands from FPL 10 Aug 1959. A lower number is earlier in that order. It is not a stop-work order. See priority-order-1959.md. */

export const PRIORITY_BANDS: Record<number, string> = {
  1: 'Promotion',
  2: 'Financial index',
  3: 'Financial cans',
  4: 'Service',
  5: 'General state',
  6: 'After these',
};

export function priorityLabel(priority: number | null | undefined): string {
  if (priority == null) return '';
  const name = PRIORITY_BANDS[priority];
  return name ? `P${priority} ${name}` : `P${priority}`;
}
