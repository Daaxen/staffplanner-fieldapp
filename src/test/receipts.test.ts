import { describe, expect, it } from 'vitest';
import { receiptFileName, receiptRequired } from '@/lib/receipts';
import { expenseEntrySchema, firstIssue } from '@/lib/validation/reporting';

const entry = (over: Record<string, unknown> = {}) => ({
  projectId: 'ORD-1',
  date: '2026-09-19',
  category: 'materials',
  kind: 'expense' as const,
  amount: 500,
  ...over,
});

describe('receipt rules', () => {
  it('never requires a receipt, in any category or amount', () => {
    for (const c of ['materials', 'travel', 'parking', 'meal', 'other']) expect(receiptRequired(c, 10000)).toBe(false);
  });

  it('saves an expense without a receipt', () => {
    expect(expenseEntrySchema.safeParse(entry()).success).toBe(true);
  });

  it('accepts the expense once a receipt path is attached', () => {
    const result = expenseEntrySchema.safeParse(entry({ receiptName: 'user/receipts/1.jpg' }));
    expect(result.success).toBe(true);
  });

  it('does not demand a receipt for credits and corrections', () => {
    expect(expenseEntrySchema.safeParse(entry({ kind: 'credit', amount: -500 })).success).toBe(true);
  });

  it('shows the stored file name', () => {
    expect(receiptFileName('uid/receipts/173-abc.pdf')).toBe('173-abc.pdf');
  });
});
