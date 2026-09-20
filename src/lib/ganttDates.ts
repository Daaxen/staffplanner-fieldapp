/**
 * Calendar-day maths for the planning board.
 *
 * Order dates are plain calendar dates ("2026-09-20"), while the board's grid
 * start is a Date in the browser's timezone. Subtracting the two directly
 * mixes timezones and clock time, which shifted bars one day. These helpers
 * compare calendar days only.
 */

const DAY = 24 * 60 * 60 * 1000;

function utcDay(year: number, month: number, day: number) {
  return Date.UTC(year, month, day) / DAY;
}

/** Day index of a calendar date relative to the grid's first day. */
export function dayOffset(dateStr: string, gridStart: Date): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return 0;
  return utcDay(y, m - 1, d) - utcDay(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate());
}

/** True when an inclusive date range overlaps the visible window (also inclusive). */
export function overlapsRange(
  startStr: string,
  endStr: string,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const startIdx = dayOffset(startStr, rangeStart);
  const endIdx = dayOffset(endStr || startStr, rangeStart);
  const lastIdx = dayOffset(
    `${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, '0')}-${String(rangeEnd.getDate()).padStart(2, '0')}`,
    rangeStart,
  );
  return endIdx >= 0 && startIdx <= lastIdx;
}

/** Whole days covered by an inclusive date range. */
export function dayCount(startStr: string, endStr: string): number {
  const [y1, m1, d1] = startStr.split('-').map(Number);
  const [y2, m2, d2] = endStr.split('-').map(Number);
  if (!y1 || !y2) return 1;
  return Math.max(utcDay(y2, m2 - 1, d2) - utcDay(y1, m1 - 1, d1) + 1, 1);
}
