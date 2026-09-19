import { describe, expect, it } from 'vitest';
import { formatVariance, sumActualTime, variancePct, varianceTone } from '@/lib/timeVariance';

describe('actual time', () => {
  it('sums work and travel into a total', () => {
    const actual = sumActualTime([
      { hours: 6, travelHours: 0.8 },
      { hours: 0.5, travelHours: 0 },
    ]);
    expect(actual.work).toBe(6.5);
    expect(actual.travel).toBe(0.8);
    expect(actual.total).toBe(7.3);
  });

  it('treats a missing travel value as zero', () => {
    expect(sumActualTime([{ hours: 3 }]).total).toBe(3);
  });
});

describe('deviation', () => {
  it('matches the 6h planned / 7.3h actual example', () => {
    const pct = variancePct(6, 7.3);
    expect(pct).toBe(22);
    expect(formatVariance(pct)).toBe('+22%');
    expect(varianceTone(pct)).toBe('over');
  });

  it('is negative when work finished faster than planned', () => {
    expect(variancePct(8, 6)).toBe(-25);
    expect(varianceTone(-25)).toBe('under');
  });

  it('has no value without a plan', () => {
    expect(variancePct(undefined, 5)).toBeNull();
    expect(variancePct(0, 5)).toBeNull();
    expect(formatVariance(null)).toBe('—');
  });
});
