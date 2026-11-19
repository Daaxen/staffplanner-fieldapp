import { describe, it, expect } from 'vitest';
import { periodButtonLabel } from '@/lib/ganttDates';
describe('periodButtonLabel', () => {
  it('uses the shown week, not today', () => {
    expect(periodButtonLabel('week', new Date(2026, 10, 23))).toBe('Vecka 48');
  });
  it('shows the shown month', () => {
    expect(periodButtonLabel('month', new Date(2026, 11, 1))).toBe('december');
  });
});
