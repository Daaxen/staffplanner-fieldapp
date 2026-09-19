import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');

const sql = readdirSync(MIGRATIONS)
  .filter(f => f.endsWith('.sql'))
  .sort()
  .map(f => readFileSync(join(MIGRATIONS, f), 'utf8'))
  .join('\n');

describe('one installer record per user profile', () => {
  it('has a partial unique index on installers.profile_id', () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS installers_profile_id_unique\s+ON public\.installers \(profile_id\) WHERE profile_id IS NOT NULL/i,
    );
  });

  it('deduplicates before enforcing the index', () => {
    const dedup = sql.slice(sql.lastIndexOf('$dedup$'));
    expect(sql).toMatch(/GROUP BY profile_id HAVING count\(\*\) > 1/i);
    // duplicates are merged, never blindly deleted with their records
    for (const table of [
      'assignments', 'installer_absences', 'time_entries', 'expense_entries',
      'mileage_entries', 'deviations', 'reminders',
    ]) {
      expect(sql).toMatch(new RegExp(`UPDATE public\\.${table}\\s+SET installer_id = keep`, 'i'));
    }
    expect(dedup).toBeDefined();
  });

  it('provisions installer records with a safe upsert', () => {
    const fn = sql.slice(sql.lastIndexOf('CREATE OR REPLACE FUNCTION public.ensure_installer_record'));
    expect(fn).toMatch(/INSERT INTO public\.installers[\s\S]*ON CONFLICT \(profile_id\) WHERE profile_id IS NOT NULL DO NOTHING/i);
  });

  it('keeps profile_id nullable for external subcontractors', () => {
    expect(sql).not.toMatch(/ALTER TABLE public\.installers[\s\S]{0,80}ALTER COLUMN profile_id SET NOT NULL/i);
  });

  it('ships a concurrency test', () => {
    const test = readFileSync(join(process.cwd(), 'supabase/tests/installer_uniqueness_test.sql'), 'utf8');
    expect(test).toMatch(/Racer 1/);
    expect(test).toMatch(/ON CONFLICT \(profile_id\) WHERE profile_id IS NOT NULL DO NOTHING/i);
  });
});
