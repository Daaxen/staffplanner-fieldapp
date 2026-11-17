import { describe, it, expect } from 'vitest';
import { occupancyPct } from '@/lib/occupancy';
const week = ['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20','2026-11-21','2026-11-22'];
describe('occupancyPct', () => {
  it('full weekdays = 100%', () => expect(occupancyPct(week, [{ startDate: '2026-11-16', endDate: '2026-11-20' }], [])).toBe(100));
  it('4 weekdays = 80%', () => expect(occupancyPct(week, [{ startDate: '2026-11-16', endDate: '2026-11-19' }], [])).toBe(80));
  it('weekdays + saturday = 120%', () => expect(occupancyPct(week, [{ startDate: '2026-11-16', endDate: '2026-11-21', worksWeekends: true }], [])).toBe(120));
  it('weekend on non-weekend order not counted', () => expect(occupancyPct(week, [{ startDate: '2026-11-16', endDate: '2026-11-22' }], [])).toBe(100));
  it('absence lowers target', () => expect(occupancyPct(week, [{ startDate: '2026-11-16', endDate: '2026-11-19' }], [{ startDate: '2026-11-20', endDate: '2026-11-20' }])).toBe(100));
});
