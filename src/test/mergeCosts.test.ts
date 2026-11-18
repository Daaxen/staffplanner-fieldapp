import { describe, it, expect } from 'vitest';
import { mergeCosts, type TimeRow } from '@/lib/timeReporting';
const row = (id: string, date: string): TimeRow => ({ id, installer_id: 'i1', entry_date: date, client_id: 'c', project_group_id: null, project_id: 'o1', activity_type_id: 'a', hours: 8, travel_hours: 0, description: null, note: null, created_at: '', updated_at: '' });
describe('mergeCosts', () => {
  it('puts costs on the time row with same installer, order and day', () => {
    const out = mergeCosts([row('t1', '2026-11-16')], { expenses: [{ installer_id: 'i1', project_id: 'o1', entry_date: '2026-11-16', amount: 450 }], mileage: [{ installer_id: 'i1', project_id: 'o1', entry_date: '2026-11-16', amount: 155, km: 62 }], perDiem: [{ installer_id: 'i1', project_id: 'o1', entry_date: '2026-11-16', amount: 640 }] }, []);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ expense: 450, km: 62, mileage: 155, perDiem: 640 });
  });
  it('cost without time that day becomes own row with zero hours', () => {
    const out = mergeCosts([row('t1', '2026-11-16')], { expenses: [{ installer_id: 'i1', project_id: 'o1', entry_date: '2026-11-19', amount: 1200 }], mileage: [], perDiem: [] }, [{ id: 'o1', client_id: 'c', project_group_id: null }]);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ costOnly: true, hours: 0, expense: 1200, client_id: 'c' });
  });
  it('costs count once even with two time rows that day', () => {
    const out = mergeCosts([row('t1', '2026-11-16'), row('t2', '2026-11-16')], { expenses: [{ installer_id: 'i1', project_id: 'o1', entry_date: '2026-11-16', amount: 100 }], mileage: [], perDiem: [] }, []);
    expect(out.reduce((s, r) => s + r.expense, 0)).toBe(100);
  });
  it('keeps each entry so the breakdown adds up to the cell', () => {
    const e = (amount: number, category: string) => ({ installer_id: 'i1', project_id: 'o1', entry_date: '2026-11-16', amount, category });
    const out = mergeCosts([row('t1', '2026-11-16')], { expenses: [e(2150, 'accommodation'), e(893.45, 'materials'), e(400, 'parking')], mileage: [], perDiem: [] }, []);
    expect(out[0].expenseItems?.map(i => i.category)).toEqual(['accommodation', 'materials', 'parking']);
    expect(out[0].expenseItems!.reduce((s, i) => s + Number(i.amount), 0)).toBeCloseTo(out[0].expense);
    expect(out[0].expense).toBeCloseTo(3443.45);
  });
});
