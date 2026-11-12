import { describe, it, expect } from 'vitest';
import { reportingRate, rateTone } from '@/lib/timeReporting';
const P = [{ id: 'a', name: 'A' }];
// 2026-11-09 is a Monday
describe('reportingRate', () => {
  it('5 weekdays = 40 h available', () => {
    expect(reportingRate([{ installer_id: 'a', hours: 36 }], P, [], { from: '2026-11-09', to: '2026-11-13' })[0]).toMatchObject({ available: 40, pct: 90 });
  });
  it('absence day removes 8 h', () => {
    expect(reportingRate([], P, [{ installerId: 'a', startDate: '2026-11-10', endDate: '2026-11-10' }], { from: '2026-11-09', to: '2026-11-13' })[0].available).toBe(32);
  });
  it('weekend gives 0 available', () => {
    expect(reportingRate([], P, [], { from: '2026-11-14', to: '2026-11-15' })).toHaveLength(0);
  });
  it('tone thresholds 90/60', () => {
    expect([rateTone(90), rateTone(89), rateTone(60), rateTone(59)]).toEqual(['green', 'yellow', 'yellow', 'red']);
  });
});
import { periodRange, shiftPeriod, periodLabel } from '@/lib/timeReporting';
describe('periodRange', () => {
  it('week is Monday–Sunday', () => expect(periodRange('week', new Date(2026, 10, 12))).toEqual({ from: '2026-11-09', to: '2026-11-15' }));
  it('half month 1–15 and 16–end', () => {
    expect(periodRange('half', new Date(2026, 10, 3))).toEqual({ from: '2026-11-01', to: '2026-11-15' });
    expect(periodRange('half', new Date(2026, 10, 20))).toEqual({ from: '2026-11-16', to: '2026-11-30' });
    expect(periodRange('half', new Date(2027, 1, 20))).toEqual({ from: '2027-02-16', to: '2027-02-28' });
  });
  it('month', () => expect(periodRange('month', new Date(2026, 11, 5))).toEqual({ from: '2026-12-01', to: '2026-12-31' }));
  it('half month steps', () => {
    expect(periodRange('half', shiftPeriod('half', new Date(2026, 10, 3), -1)).from).toBe('2026-10-16');
    expect(periodRange('half', shiftPeriod('half', new Date(2026, 10, 20), 1)).from).toBe('2026-12-01');
  });
  it('week label', () => expect(periodLabel('week', new Date(2026, 10, 12))).toBe('v.46 (9–15 nov)'));
});
