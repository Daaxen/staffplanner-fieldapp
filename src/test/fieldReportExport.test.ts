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

import { flatReportRows } from '@/lib/fieldReportExport';
describe('per diem and flat export', () => {
  const d = (): FieldReportData => ({
    orderId: 'o', orderName: 'Scandic Vaasa', orderNumber: '1034', clientName: 'Scandic', reports: [], dev: [],
    time: [{ installer_id: 'i', entry_date: '2026-11-10', hours: 8, travel_hours: 4, hourly_rate: 650 }],
    mil: [{ installer_id: 'i', entry_date: '2026-11-10', km: 100, amount: 250 }],
    exp: [{ installer_id: 'i', entry_date: '2026-11-11', category: 'material', amount: 1450 }],
    perDiem: [{ installer_id: 'i', entry_date: '2026-11-10', country: 'Finland', day_type: 'full', amount: 780 }],
    names: { i: 'Felix' }, order: null, client: null, photos: {},
  });
  it('adds per diem to the total unless excluded', () => {
    expect(combinedTotals([d()]).grand).toBe(5200 + 250 + 1450 + 780);
    expect(combinedTotals([d()], ['perdiem']).grand).toBe(5200 + 250 + 1450);
  });
  it('gives one row per transaction with a cost type', () => {
    expect(flatReportRows([d()]).map(r => r.Kostnadsslag)).toEqual(['Arbete', 'Restid', 'Körning', 'Traktamente', 'Utlägg']);
    expect(flatReportRows([d()], ['perdiem', 'travel']).map(r => r.Kostnadsslag)).toEqual(['Arbete', 'Utlägg']);
  });
});
