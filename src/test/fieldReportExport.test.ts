import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { combinedTotals, DEFAULT_EXCLUDES, type FieldReportData } from '@/lib/fieldReportExport';

const order = (id: string, rate: number, extra: Partial<FieldReportData> = {}): FieldReportData => ({
  orderId: id, orderName: id, reports: [], dev: [], names: {}, photos: {}, client: null, order: { hourly_rate: rate },
  time: [{ installer_id: 'a', hours: 8, travel_hours: 2 }], mil: [{ installer_id: 'a', km: 10, amount: 25 }], exp: [{ installer_id: 'a', category: 'p', amount: 50 }],
  ...extra,
});

describe('combined report totals', () => {
  it('sums work, mileage and expenses across orders', () => {
    const r = combinedTotals([order('A', 500), order('B', 600)]);
    expect(r.grand).toBe(4075 + 4875);
    expect(r.hours).toBe(16);
  });
  it('drops mileage when travel is excluded and expenses when excluded', () => {
    expect(combinedTotals([order('A', 500)], ['travel']).grand).toBe(4050);
    expect(combinedTotals([order('A', 500)], ['travel', 'expenses']).grand).toBe(4000);
  });
  it('client preset leaves out prices, comments and deviations; internal leaves out nothing', () => {
    expect(DEFAULT_EXCLUDES.client).toEqual(['prices', 'comments', 'deviations']);
    expect(DEFAULT_EXCLUDES.internal).toEqual([]);
  });
});
