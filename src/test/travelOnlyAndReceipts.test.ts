import { describe, it, expect } from 'vitest';
import { timeEntrySchema } from '@/lib/validation/reporting';
import { receiptPathsOf } from '@/lib/receipts';

describe('travel-only time entries', () => {
  it('accepts a day with only travel time', () => {
    expect(timeEntrySchema.safeParse({ projectId: 'p', date: '2026-11-12', hours: 0, travelHours: 2.5 }).success).toBe(true);
  });
  it('rejects a row with neither work nor travel', () => {
    expect(timeEntrySchema.safeParse({ projectId: 'p', date: '2026-11-12', hours: 0, travelHours: 0 }).success).toBe(false);
  });
});

describe('multiple receipts', () => {
  it('returns every receipt on the list', () => {
    expect(receiptPathsOf({ receipt_path: 'a', receipt_paths: ['a', 'b', 'c'] })).toEqual(['a', 'b', 'c']);
  });
  it('falls back to the single old receipt', () => {
    expect(receiptPathsOf({ receipt_path: 'a', receipt_paths: [] })).toEqual(['a']);
  });
});
