import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { EXPORT_COLUMNS, buildWorkbook, exportFileName, sumBy, validateRow, weekDays } from '@/lib/timeReporting';

const clients = [
  { id: 'c1', name: 'Kund A', customer_number: '10' },
  { id: 'c2', name: 'Kund B', customer_number: '11' },
  { id: 'int', name: 'Dynamic Places AB', customer_number: '9999' },
];
const groups = [
  { id: 'g1', name: 'Proj A', project_number: 'P1', client_id: 'c1' },
  { id: 'gi', name: 'Lager', project_number: null, client_id: 'int' },
];
const orders = [{ id: 'o1', name: 'Order', project_number: 'O1', client_id: 'c1', project_group_id: 'g1' }];
const ctx = { clients, groups, orders, otherHoursThatDay: 0 };
const base = { date: '2026-09-26', clientId: 'c1', activityTypeId: 'a', hours: 2 };

describe('time reporting validation', () => {
  it('accepts customer only, customer+project, and order', () => {
    expect(validateRow(base, ctx)).toBeNull();
    expect(validateRow({ ...base, projectGroupId: 'g1' }, ctx)).toBeNull();
    expect(validateRow({ ...base, projectGroupId: 'g1', orderId: 'o1' }, ctx)).toBeNull();
  });
  it('requires customer, activity and positive hours', () => {
    expect(validateRow({ ...base, clientId: '' }, ctx)).toMatch(/kund/i);
    expect(validateRow({ ...base, activityTypeId: '' }, ctx)).toMatch(/aktivitet/i);
    expect(validateRow({ ...base, hours: 0 }, ctx)).toMatch(/större än 0/);
    expect(validateRow({ ...base, hours: 25 }, ctx)).toMatch(/24/);
  });
  it('rejects project or order from another customer', () => {
    expect(validateRow({ ...base, clientId: 'c2', projectGroupId: 'g1' }, ctx)).toMatch(/tillhör inte/);
    expect(validateRow({ ...base, clientId: 'c2', orderId: 'o1' }, ctx)).toMatch(/tillhör inte/);
  });
  it('enforces 24 h per day', () => {
    expect(validateRow({ ...base, hours: 5 }, { ...ctx, otherHoursThatDay: 20 })).toMatch(/dagen/);
  });
  it('customer 9999 needs a clear description and internal projects only', () => {
    const i = { ...base, clientId: 'int' };
    expect(validateRow(i, ctx)).toMatch(/Beskrivning krävs/);
    expect(validateRow({ ...i, description: 'internt' }, ctx)).toMatch(/tydligt/);
    expect(validateRow({ ...i, description: 'Materialinventering i lagret' }, ctx)).toBeNull();
    expect(validateRow({ ...i, description: 'Materialinventering i lagret', projectGroupId: 'g1' }, ctx)).toMatch(/interna projekt/);
    expect(validateRow({ ...i, description: 'Materialinventering i lagret', projectGroupId: 'gi' }, ctx)).toBeNull();
  });
});

describe('summaries and export', () => {
  it('sums per key', () => {
    const s = sumBy([{ k: 'a', h: 1 }, { k: 'a', h: 2.5 }, { k: 'b', h: 1 }], r => r.k, r => r.h);
    expect(s).toEqual([{ key: 'a', hours: 3.5 }, { key: 'b', hours: 1 }]);
  });
  it('builds week Monday–Sunday', () => {
    expect(weekDays('2026-09-26')).toEqual(['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27']);
  });
  it('exports exactly the spec columns and total', () => {
    const line = Object.fromEntries(EXPORT_COLUMNS.map(c => [c, c === 'Antal timmar' ? 2 : 'x'])) as never;
    const wb = buildWorkbook([line, line]);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Tidsrapport, { header: 1 });
    expect(rows[0]).toEqual([...EXPORT_COLUMNS]);
    expect(JSON.stringify(rows[0])).not.toMatch(/debiter|status|godkänd|avvis/i);
    expect(rows[rows.length - 1][8]).toBe(4);
    expect(exportFileName('2026-09-01', '2026-09-30')).toBe('tidsrapport_2026-09-01_2026-09-30.xlsx');
  });
});
