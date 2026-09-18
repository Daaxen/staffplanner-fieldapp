import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIVE_BOOKING_STATUSES, OVERRIDE_REASON_MIN, bookingWindow } from '@/lib/bookings';

const dir = join(process.cwd(), 'supabase', 'migrations');
const sql = readdirSync(dir)
  .filter(f => f.endsWith('.sql'))
  .map(f => readFileSync(join(dir, f), 'utf8'))
  .join('\n');

describe('booking model (database)', () => {
  it('creates a dedicated assignments table with the required columns', () => {
    expect(sql).toMatch(/CREATE TABLE public\.assignments/);
    for (const col of [
      'project_id', 'installer_id', 'planned_start_at', 'planned_end_at',
      'assignment_status', 'created_by', 'created_at', 'updated_at',
    ]) {
      expect(sql).toContain(col);
    }
  });

  it('prevents an end before the start', () => {
    expect(sql).toMatch(/assignments_time_range[\s\S]*planned_end_at >= planned_start_at/);
  });

  it('uses an exclusion constraint for overlapping active bookings', () => {
    expect(sql).toMatch(/EXCLUDE USING gist/);
    expect(sql).toMatch(/assignments_no_overlap/);
    expect(sql).toMatch(/installer_id WITH =/);
  });

  it('checks absences and requires an admin reason to override', () => {
    expect(sql).toMatch(/installer_absences[\s\S]*daterange/);
    expect(sql).toMatch(/An admin must supply an override reason/);
    expect(sql).toMatch(/Only admins may override booking conflicts/);
  });

  it('audits overridden conflicts', () => {
    expect(sql).toMatch(/CREATE TABLE public\.assignment_overrides/);
    expect(sql).toMatch(/INSERT INTO public\.assignment_overrides/);
  });

  it('keeps project membership in sync and enables RLS', () => {
    expect(sql).toMatch(/INSERT INTO public\.project_assignees[\s\S]*ON CONFLICT DO NOTHING/);
    expect(sql).toMatch(/ALTER TABLE public\.assignments ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/GRANT SELECT, INSERT, UPDATE, DELETE ON public\.assignments TO authenticated/);
  });
});

describe('booking helpers', () => {
  it('builds a window covering the whole period', () => {
    const { start, end } = bookingWindow('2026-10-05', '2026-10-06', '08:00', '17:00');
    expect(new Date(start).getTime()).toBeLessThan(new Date(end).getTime());
  });

  it('defaults to full days without times', () => {
    const { start, end } = bookingWindow('2026-10-05', '2026-10-05');
    expect(new Date(end).getTime() - new Date(start).getTime()).toBeGreaterThan(20 * 3600 * 1000);
  });

  it('treats only planned/confirmed/in-progress as blocking', () => {
    expect([...ACTIVE_BOOKING_STATUSES]).toEqual(['planned', 'confirmed', 'in_progress']);
    expect(OVERRIDE_REASON_MIN).toBeGreaterThanOrEqual(10);
  });
});
