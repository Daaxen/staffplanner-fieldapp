import { describe, it, expect } from 'vitest';
import { isWeekendIso, weekendSegments } from '@/lib/ganttDates';

describe('weekend helpers', () => {
  it('detects Saturday and Sunday', () => {
    expect(isWeekendIso('2026-11-14')).toBe(true);
    expect(isWeekendIso('2026-11-15')).toBe(true);
    expect(isWeekendIso('2026-11-13')).toBe(false);
  });
  it('returns weekend column indexes from the grid start (Mon Nov 9)', () => {
    expect(weekendSegments('2026-11-11', '2026-11-17', new Date(2026, 10, 9))).toEqual([5, 6]);
  });
  it('skips weekend days before the visible grid', () => {
    expect(weekendSegments('2026-11-07', '2026-11-10', new Date(2026, 10, 9))).toEqual([]);
  });
});
