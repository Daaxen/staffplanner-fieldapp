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
