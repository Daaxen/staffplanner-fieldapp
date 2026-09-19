import { describe, expect, it } from 'vitest';
import { hoursBetween, timeMismatch, timeMismatchMessage, HOURS_TOLERANCE } from '@/lib/validation/reporting';

describe('time correction', () => {
  it('calculates hours from start and finish', () => {
    expect(hoursBetween('08:00', '14:30')).toBe(6.5);
  });

  it('reports no mismatch when the figures agree', () => {
    expect(timeMismatch({ startTime: '08:00', endTime: '14:30', hours: 6.5 })).toBeNull();
  });

  it('accepts rounding differences within the tolerance', () => {
    expect(timeMismatch({ startTime: '08:00', endTime: '14:30', hours: 6.5 + HOURS_TOLERANCE })).toBeNull();
  });

  it('reports a mismatch when typed hours disagree', () => {
    expect(timeMismatch({ startTime: '08:00', endTime: '14:30', hours: 8 })).toEqual({ computed: 6.5, stated: 8 });
  });

  it('stays silent when no hours are typed or times are missing', () => {
    expect(timeMismatch({ startTime: '08:00', endTime: '14:30' })).toBeNull();
    expect(timeMismatch({ hours: 8 })).toBeNull();
  });

  it('explains the difference in Swedish with both figures', () => {
    const message = timeMismatchMessage({ computed: 6.5, stated: 8 });
    expect(message).toContain('6,50 h');
    expect(message).toContain('8,00 h');
    expect(message).toContain('Godkänn');
  });
});
