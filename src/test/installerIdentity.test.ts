import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');

function migrationSql() {
  return readdirSync(MIGRATIONS)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n');
}

const OPERATIONAL_TABLES = [
  'time_entries',
  'expense_entries',
  'mileage_entries',
  'active_timers',
  'deviations',
  'field_reports',
  'reminders',
];

describe('canonical installer identity', () => {
  const sql = migrationSql();

  it.each(OPERATIONAL_TABLES)('%s.installer_id references public.installers', table => {
    const re = new RegExp(
      `ALTER TABLE public\\.${table}\\s+ADD CONSTRAINT ${table}_installer_id_fkey\\s+FOREIGN KEY \\(installer_id\\) REFERENCES public\\.installers\\(id\\)`,
      'i',
    );
    expect(sql).toMatch(re);
  });

  it('keeps one installer record per login account', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS installers_profile_id_unique[\s\S]*profile_id IS NOT NULL/i);
  });

  it('exposes a helper resolving the signed-in user to their installer record', () => {
    expect(sql).toMatch(/FUNCTION public\.current_installer_id\(\)/i);
    expect(sql).toMatch(/SELECT id FROM public\.installers WHERE profile_id = auth\.uid\(\)/i);
  });

  it('scopes reporting policies to the installer record, not the login account', () => {
    const policyBlock = sql.slice(sql.indexOf('DROP POLICY IF EXISTS "time own read"'));
    expect(policyBlock).toMatch(/installer_id = public\.current_installer_id\(\)/);
    expect(policyBlock).not.toMatch(/installer_id = auth\.uid\(\)/);
  });

  it('never writes the auth user id into an operational installer_id', () => {
    const files = [
      'src/lib/offline/fieldWork.ts',
      'src/lib/deviations.ts',
      'src/hooks/useInstallerLogs.ts',
    ];
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/installer_id:\s*(userId|user\?\.id|user\.id)/);
    }
  });
});
