import { describe, expect, it } from 'vitest';
import { overlapsRange } from '@/lib/ganttDates';

const start = new Date(2026, 8, 14); // 2026-09-14
const end = new Date(2026, 8, 27); // 2026-09-27

describe('overlapsRange', () => {
  it('includes an order fully inside the window', () => {
    expect(overlapsRange('2026-09-20', '2026-09-21', start, end)).toBe(true);
  });

  it('includes an order starting before and ending inside', () => {
    expect(overlapsRange('2026-09-10', '2026-09-15', start, end)).toBe(true);
  });

  it('includes an order starting inside and running past the window', () => {
    expect(overlapsRange('2026-09-26', '2026-10-05', start, end)).toBe(true);
  });

  it('includes an order spanning the whole window', () => {
    expect(overlapsRange('2026-08-01', '2026-12-01', start, end)).toBe(true);
  });

  it('excludes an order entirely in the future', () => {
    expect(overlapsRange('2026-09-28', '2026-09-29', start, end)).toBe(false);
  });

  it('excludes an order entirely in the past', () => {
    expect(overlapsRange('2026-09-12', '2026-09-13', start, end)).toBe(false);
  });

  it('treats the boundary days as inside', () => {
    expect(overlapsRange('2026-09-14', '2026-09-14', start, end)).toBe(true);
    expect(overlapsRange('2026-09-27', '2026-09-27', start, end)).toBe(true);
  });
});
