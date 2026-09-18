import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const migrations = () => {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(dir, f), 'utf8'));
};

const allSql = () => migrations().join('\n');

const SENSITIVE = ['hourly_rate', 'overtime_rate', 'mileage_rate', 'vat_percent', 'customerNumber', 'invoicing', 'rates'];

describe('clients RLS', () => {
  it('drops the permissive "signed-in users" read policy', () => {
    const sql = allSql();
    expect(sql).toMatch(/DROP POLICY IF EXISTS "clients read for signed-in users" ON public\.clients/i);
    // and no later migration re-creates it
    const files = migrations();
    const dropAt = files.findIndex((s) => /DROP POLICY IF EXISTS "clients read for signed-in users"/i.test(s));
    const recreated = files
      .slice(dropAt + 1)
      .some((s) => /CREATE POLICY "clients read for signed-in users"/i.test(s));
    expect(recreated).toBe(false);
  });

  it('exposes only safe client fields through assigned_clients()', () => {
    const fn = allSql().match(/CREATE OR REPLACE FUNCTION public\.assigned_clients\(\)[\s\S]*?\$function\$;/i)?.[0];
    expect(fn).toBeTruthy();
    for (const field of SENSITIVE) {
      expect(fn!.includes(field)).toBe(false);
    }
    expect(fn).toMatch(/is_project_member\(p\.id\)/);
    expect(fn).toMatch(/SECURITY DEFINER/i);
  });

  it('keeps the RPC off-limits to anonymous callers', () => {
    const sql = allSql();
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.assigned_clients\(\) FROM PUBLIC, anon/i);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.assigned_clients\(\) TO authenticated/i);
  });

  it('ships an executable RLS test covering all four access cases', () => {
    const t = readFileSync(join(process.cwd(), 'supabase', 'tests', 'clients_rls_test.sql'), 'utf8');
    expect(t).toMatch(/admin reads all clients/);
    expect(t).toMatch(/assigned installer sees assigned client/);
    expect(t).toMatch(/unassigned user sees no clients/);
    expect(t).toMatch(/no commercial fields for installer/);
  });
});
