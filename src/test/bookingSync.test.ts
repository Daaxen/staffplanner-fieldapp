import { describe, it, expect } from 'vitest';
import {
  bookingRowsFor,
  bookingStatusForProject,
  bookingWindow,
  isConflictError,
  bookingErrorMessage,
  OVERRIDE_REASON_MIN,
  isValidInstallerRange,
  shiftInstallerOverrides,
} from '@/lib/bookings';

const base = {
  id: 'P-1',
  status: 'scheduled',
  startDate: '2026-04-01',
  endDate: '2026-04-02',
  startTime: '08:00',
  endTime: '16:00',
  assigneeIds: ['i1', 'i2'],
};

describe('booking sync', () => {
  it('creates one booking per installer', () => {
    const rows = bookingRowsFor(base, 'row-1');
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.installer_id)).toEqual(['i1', 'i2']);
    expect(rows[0].project_id).toBe('row-1');
  });

  it('never creates duplicates for the same installer', () => {
    const rows = bookingRowsFor({ ...base, assigneeIds: ['i1', 'i1', 'i2'] }, 'row-1');
    expect(rows.map(r => r.installer_id)).toEqual(['i1', 'i2']);
  });

  it('drops bookings when the team is emptied', () => {
    expect(bookingRowsFor({ ...base, assigneeIds: [] }, 'row-1')).toEqual([]);
  });

  it('drops bookings when the order is cancelled', () => {
    expect(bookingRowsFor({ ...base, status: 'cancelled' }, 'row-1')).toEqual([]);
  });

  it('follows new dates and times after a move in the plan', () => {
    const moved = bookingRowsFor(
      { ...base, startDate: '2026-05-05', endDate: '2026-05-05', startTime: '07:00', endTime: '12:00' },
      'row-1',
    );
    const { start, end } = bookingWindow('2026-05-05', '2026-05-05', '07:00', '12:00');
    expect(moved[0].planned_start_at).toBe(start);
    expect(moved[0].planned_end_at).toBe(end);
  });

  it('stores the override reason on every booking', () => {
    const rows = bookingRowsFor(base, 'row-1', '  Customer insisted on this date  ');
    expect(rows.every(r => r.override_reason === 'Customer insisted on this date')).toBe(true);
    expect('Customer insisted on this date'.length).toBeGreaterThanOrEqual(OVERRIDE_REASON_MIN);
  });

  it('ignores a blank override reason', () => {
    expect(bookingRowsFor(base, 'row-1', '   ')[0].override_reason).toBeNull();
  });

  it('mirrors the order state', () => {
    expect(bookingStatusForProject('in-progress')).toBe('in_progress');
    expect(bookingStatusForProject('completed')).toBe('completed');
    expect(bookingStatusForProject('cancelled')).toBe('cancelled');
    expect(bookingStatusForProject('scheduled')).toBe('planned');
  });

  it('recognises a refused booking and explains it in Swedish', () => {
    expect(isConflictError('conflicting key value violates assignments_no_overlap')).toBe(true);
    expect(isConflictError('Installer has a planned absence in this period')).toBe(true);
    expect(isConflictError('network down')).toBe(false);
    expect(bookingErrorMessage('assignments_no_overlap')).toContain('krockar');
    expect(bookingErrorMessage('network down')).toContain('kunde inte sparas');
  });
});

describe('installers on part of an order', () => {
  const order = { ...base, startDate: '2026-10-05', endDate: '2026-10-09', assigneeIds: ['felix', 'thea'],
    installerDateOverrides: { thea: { startDate: '2026-10-06', endDate: '2026-10-07' } } };

  it('books an installer with own days only on those days, others on the whole order', () => {
    const rows = bookingRowsFor(order, 'row-1');
    const thea = rows.find(r => r.installer_id === 'thea')!;
    const felix = rows.find(r => r.installer_id === 'felix')!;
    expect(thea.planned_start_at).toBe(bookingWindow('2026-10-06', '2026-10-06', '08:00', '16:00').start);
    expect(thea.planned_end_at).toBe(bookingWindow('2026-10-07', '2026-10-07', '08:00', '16:00').end);
    expect(felix.planned_start_at).toBe(bookingWindow('2026-10-05', '2026-10-05', '08:00', '16:00').start);
    expect(felix.planned_end_at).toBe(bookingWindow('2026-10-09', '2026-10-09', '08:00', '16:00').end);
  });

  it('rejects own days outside the order period', () => {
    expect(isValidInstallerRange('2026-10-05', '2026-10-09', { startDate: '2026-10-04', endDate: '2026-10-06' })).toBe(false);
    expect(isValidInstallerRange('2026-10-05', '2026-10-09', { startDate: '2026-10-08', endDate: '2026-10-10' })).toBe(false);
    expect(isValidInstallerRange('2026-10-05', '2026-10-09', { startDate: '2026-10-06', endDate: '2026-10-07' })).toBe(true);
  });

  it('moves own days by the same number of days when the order moves', () => {
    const shifted = shiftInstallerOverrides(order.installerDateOverrides, '2026-10-05', '2026-10-12', '2026-10-16');
    expect(shifted.thea).toEqual({ startDate: '2026-10-13', endDate: '2026-10-14' });
  });
});
