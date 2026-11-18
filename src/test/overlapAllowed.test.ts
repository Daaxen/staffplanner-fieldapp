import { describe, it, expect } from 'vitest';
import { installerConflicts } from '@/lib/schedulingConflicts';

const inst = { id: 'i1', name: 'Felix', absences: [] } as never;
const other = { id: 'p2', name: 'Order B', status: 'scheduled', assigneeIds: ['i1'], startDate: '2026-11-18', endDate: '2026-11-18', startTime: '08:00', endTime: '16:00' } as never;

describe('overlapping work orders', () => {
  it('same installer on two overlapping orders the same day is not a conflict', () => {
    const out = installerConflicts(inst, { projectId: 'p1', startDate: '2026-11-18', endDate: '2026-11-18', startTime: '08:00', endTime: '16:00' } as never, [other]);
    expect(out.filter(c => c.kind === 'overlap')).toHaveLength(0);
  });
  it('absence still blocks', () => {
    const away = { ...(inst as object), absences: [{ id: 'a', type: 'vacation', startDate: '2026-11-18', endDate: '2026-11-18' }] } as never;
    const out = installerConflicts(away, { projectId: 'p1', startDate: '2026-11-18', endDate: '2026-11-18' } as never, []);
    expect(out.some(c => c.kind === 'availability' && c.severity === 'blocking')).toBe(true);
  });
});
