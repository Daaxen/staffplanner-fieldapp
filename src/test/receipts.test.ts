import { describe, expect, it } from 'vitest';
import { missingReceiptMessage, receiptFileName, receiptRequired } from '@/lib/receipts';
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
  it('requires a receipt for categories that demand one', () => {
    expect(receiptRequired('materials', 100)).toBe(true);
    expect(receiptRequired('meal', 80)).toBe(true);
  });

  it('respects the category threshold', () => {
    expect(receiptRequired('parking', 80)).toBe(false);
    expect(receiptRequired('parking', 150)).toBe(true);
  });

  it('gives a clear Swedish message', () => {
    expect(missingReceiptMessage('materials')).toMatch(/Kvitto krävs för den här kostnadstypen/);
    expect(missingReceiptMessage('parking')).toMatch(/över 100 kr/);
  });

  it('blocks saving an expense without the required receipt', () => {
    const issue = firstIssue(expenseEntrySchema.safeParse(entry()));
    expect(issue).toMatch(/Kvitto krävs/);
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
