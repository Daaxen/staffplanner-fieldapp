import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DATE_RANGE_MESSAGE_SV,
  absenceDateRangeError,
  absenceDatesSchema,
  projectDateRangeError,
  projectDatesSchema,
} from '@/lib/validation/dates';

describe('project date integrity', () => {
  it('rejects an end date before the start date with a Swedish message', () => {
    expect(projectDateRangeError('2026-05-10', '2026-05-09')).toBe(DATE_RANGE_MESSAGE_SV);
    expect(projectDatesSchema.safeParse({ startDate: '2026-01-02', endDate: '2025-12-31' }).success).toBe(false);
  });

  it('accepts equal dates', () => {
    expect(projectDateRangeError('2026-05-10', '2026-05-10')).toBeNull();
  });

  it('accepts a normal range', () => {
    expect(projectDateRangeError('2026-05-10', '2026-05-12')).toBeNull();
  });

  it('accepts open-ended orders', () => {
    expect(projectDateRangeError(null, null)).toBeNull();
    expect(projectDateRangeError('2026-05-10', null)).toBeNull();
    expect(projectDateRangeError(null, '2026-05-10')).toBeNull();
    expect(projectDateRangeError(undefined, undefined)).toBeNull();
  });

  it('rejects malformed dates', () => {
    expect(projectDateRangeError('10/05/2026', '2026-05-12')).not.toBeNull();
  });
});

describe('absence date integrity', () => {
  it('requires the end date to be on or after the start date', () => {
    expect(absenceDateRangeError('2026-07-05', '2026-07-04')).toBe(DATE_RANGE_MESSAGE_SV);
    expect(absenceDateRangeError('2026-07-05', '2026-07-05')).toBeNull();
    expect(absenceDateRangeError('2026-07-05', '2026-07-12')).toBeNull();
  });

  it('requires both dates', () => {
    expect(absenceDatesSchema.safeParse({ startDate: '2026-07-05' }).success).toBe(false);
  });
});

describe('database constraints', () => {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  const sql = readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .map(f => readFileSync(join(dir, f), 'utf8'))
    .join('\n');

  it('adds a check constraint on projects dates', () => {
    expect(sql).toMatch(/projects_date_range/);
    expect(sql).toMatch(/end_date\s*>=\s*start_date/);
  });

  it('adds a check constraint on absence dates', () => {
    expect(sql).toMatch(/installer_absences_date_range/);
  });

  it('never drops those constraints in a later migration', () => {
    expect(sql).not.toMatch(/DROP\s+CONSTRAINT\s+(IF\s+EXISTS\s+)?projects_date_range/i);
    expect(sql).not.toMatch(/DROP\s+CONSTRAINT\s+(IF\s+EXISTS\s+)?installer_absences_date_range/i);
  });
});
