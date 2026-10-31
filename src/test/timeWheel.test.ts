import { describe, expect, it } from 'vitest';
import { roundToQuarter } from '@/components/ui/time-wheel';

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
