import { billableAmount } from '@/lib/timeReporting';

type Rate = { hourly_rate?: number | null } | null | undefined;
export type BTime = { installer_id: string; hours: number; travel_hours?: number | null; hourly_rate?: number | null };
export type BMileage = { installer_id: string; km: number; amount: number };
export type BExpense = { installer_id: string; category: string; amount: number };

export type BillableLine = {
  workHours: number; workAmount: number; travelHours: number;
  km: number; mileageAmount: number; expenseAmount: number;
  expensesByCategory: Record<string, number>; unpricedRows: number; total: number;
};

const empty = (): BillableLine => ({ workHours: 0, workAmount: 0, travelHours: 0, km: 0, mileageAmount: 0, expenseAmount: 0, expensesByCategory: {}, unpricedRows: 0, total: 0 });
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Per-installer and total billables for one work order. Travel time is not priced. */
export function workOrderBillables(time: BTime[], mileage: BMileage[], expenses: BExpense[], order?: Rate, client?: Rate) {
  const per: Record<string, BillableLine> = {};
  const total = empty();
  const get = (id: string) => (per[id] ??= empty());
  for (const t of time) {
    const amt = billableAmount({ hours: Number(t.hours), hourly_rate: t.hourly_rate }, order, client);
    for (const l of [get(t.installer_id), total]) {
      l.workHours += Number(t.hours); l.travelHours += Number(t.travel_hours ?? 0);
      if (amt == null) l.unpricedRows++; else l.workAmount += amt;
    }
  }
  for (const m of mileage) for (const l of [get(m.installer_id), total]) { l.km += Number(m.km); l.mileageAmount += Number(m.amount); }
  for (const e of expenses) for (const l of [get(e.installer_id), total]) {
    l.expenseAmount += Number(e.amount);
    l.expensesByCategory[e.category] = (l.expensesByCategory[e.category] ?? 0) + Number(e.amount);
  }
  for (const l of [...Object.values(per), total]) {
    l.workHours = r2(l.workHours); l.travelHours = r2(l.travelHours); l.workAmount = r2(l.workAmount);
    l.km = r2(l.km); l.mileageAmount = r2(l.mileageAmount); l.expenseAmount = r2(l.expenseAmount);
    l.total = r2(l.workAmount + l.mileageAmount + l.expenseAmount);
  }
  return { perInstaller: per, total };
}
