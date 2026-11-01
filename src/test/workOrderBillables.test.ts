import { describe, it, expect } from 'vitest';
import { workOrderBillables } from '@/lib/workOrderBillables';

describe('workOrderBillables', () => {
  it('prices work only, sums mileage and expenses, travel unpriced', () => {
    const r = workOrderBillables(
      [{ installer_id: 'a', hours: 8, travel_hours: 2, hourly_rate: null }],
      [{ installer_id: 'a', km: 50, amount: 125 }],
      [{ installer_id: 'a', category: 'parking', amount: 75 }],
      { hourly_rate: 500 }, null,
    );
    expect(r.total.workAmount).toBe(4000);
    expect(r.total.travelHours).toBe(2);
    expect(r.total.total).toBe(4200);
  });
  it('counts rows without any rate as unpriced', () => {
    const r = workOrderBillables([{ installer_id: 'a', hours: 3 }], [], [], null, null);
    expect(r.total.unpricedRows).toBe(1);
    expect(r.total.total).toBe(0);
  });
});
