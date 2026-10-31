import { describe, expect, it } from 'vitest';
import { joinDuration, roundToQuarter, splitDuration } from '@/components/ui/time-wheel';

describe('time wheel quarter hours', () => {
  it('rounds minutes to the nearest quarter', () => {
    expect(roundToQuarter('08:07')).toEqual({ h: 8, m: 0 });
    expect(roundToQuarter('08:08')).toEqual({ h: 8, m: 15 });
    expect(roundToQuarter('08:53')).toEqual({ h: 9, m: 0 });
  });
  it('never goes past 23:45', () => {
    expect(roundToQuarter('23:59')).toEqual({ h: 23, m: 45 });
  });
});

describe('travel time wheel', () => {
  it('converts 1 h 30 min to 1.5 hours and back', () => {
    expect(joinDuration(1, 30)).toBe(1.5);
    expect(splitDuration(1.5)).toEqual({ h: 1, m: 30 });
  });
  it('rounds travel to quarters and caps at 12 h', () => {
    expect(splitDuration(0.2)).toEqual({ h: 0, m: 15 });
    expect(splitDuration(14)).toEqual({ h: 12, m: 0 });
  });
});
