import { describe, expect, it } from 'vitest';
import { expandSeries, MAX_OCCURRENCES, type RecurrenceRule } from '@/lib/recurrence';

const base: RecurrenceRule = {
  weekdays: [3, 4, 5], // Wed–Fri
  intervalWeeks: 1,
  seriesStart: '2026-09-21', // Monday
  seriesEnd: '2026-10-04',
  skipHolidays: false,
  pauses: [],
};

describe('expandSeries', () => {
  it('expands the chosen weekdays within the range', () => {
    expect(expandSeries(base).dates).toEqual([
      '2026-09-23', '2026-09-24', '2026-09-25',
      '2026-09-30', '2026-10-01', '2026-10-02',
    ]);
  });

  it('honours every-other-week', () => {
    expect(expandSeries({ ...base, intervalWeeks: 2 }).dates).toEqual([
      '2026-09-23', '2026-09-24', '2026-09-25',
    ]);
  });

  it('includes the end date itself', () => {
    const r = expandSeries({ ...base, seriesEnd: '2026-09-23' });
    expect(r.dates).toEqual(['2026-09-23']);
  });

  it('skips paused periods such as the Christmas shutdown', () => {
    const r = expandSeries({
      ...base,
      seriesStart: '2026-12-14',
      seriesEnd: '2027-01-08',
      pauses: [{ from: '2026-12-21', to: '2027-01-06' }],
    });
    expect(r.dates).toEqual(['2026-12-16', '2026-12-17', '2026-12-18', '2027-01-07', '2027-01-08']);
    expect(r.skipped.every((s) => s.reason === 'pause')).toBe(true);
    expect(r.skipped).toHaveLength(6);
  });

  it('skips Swedish public holidays when asked to', () => {
    const r = expandSeries({
      ...base,
      seriesStart: '2026-05-01', // Första maj, a Friday
      seriesEnd: '2026-05-01',
      skipHolidays: true,
    });
    expect(r.dates).toEqual([]);
    expect(r.skipped).toEqual([{ date: '2026-05-01', reason: 'holiday' }]);
  });

  it('keeps holidays when the option is off', () => {
    const r = expandSeries({
      ...base,
      seriesStart: '2026-05-01',
      seriesEnd: '2026-05-01',
      skipHolidays: false,
    });
    expect(r.dates).toEqual(['2026-05-01']);
  });

  it('returns nothing for an invalid or empty rule', () => {
    expect(expandSeries({ ...base, weekdays: [] }).dates).toEqual([]);
    expect(expandSeries({ ...base, seriesEnd: '2026-09-01' }).dates).toEqual([]);
    expect(expandSeries({ ...base, seriesStart: 'nope' }).dates).toEqual([]);
  });

  it('never generates more than the safety ceiling', () => {
    const r = expandSeries({ ...base, seriesStart: '2026-01-01', seriesEnd: '2036-01-01' });
    expect(r.dates).toHaveLength(MAX_OCCURRENCES);
  });
});
