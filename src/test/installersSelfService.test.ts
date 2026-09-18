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

const selfServiceFn = () =>
  allSql().match(
    /CREATE OR REPLACE FUNCTION public\.installer_update_self\([\s\S]*?\$function\$;/i,
  )?.[0];

const ADMIN_ONLY_COLUMNS = ['type', 'profile_id', 'sandbox', 'name', 'color'];

describe('installer self-service restrictions', () => {
  it('removes the installers self-update RLS policy and never recreates it', () => {
    const files = migrations();
    const dropAt = files.findIndex((s) =>
      /DROP POLICY IF EXISTS "installers update own record" ON public\.installers/i.test(s),
    );
    expect(dropAt).toBeGreaterThanOrEqual(0);
    const recreated = files
      .slice(dropAt + 1)
      .some((s) => /CREATE POLICY "installers update own record"/i.test(s));
    expect(recreated).toBe(false);
  });

  it('leaves only the admin write policy for installer mutations', () => {
    const sql = allSql();
    expect(sql).toMatch(/CREATE POLICY "installers admin write" ON public\.installers/i);
  });

  it('exposes a validated SECURITY DEFINER self-service RPC', () => {
    const fn = selfServiceFn();
    expect(fn).toBeTruthy();
    expect(fn).toMatch(/SECURITY DEFINER/i);
    expect(fn).toMatch(/auth\.uid\(\) IS NULL/);
    expect(fn).toMatch(/WHERE profile_id = auth\.uid\(\)/);
    // input validation
    expect(fn).toMatch(/length\(v_base_location\) > 200/);
    expect(fn).toMatch(/btrim/);
  });

  it('only writes base_location — never admin-managed columns', () => {
    const fn = selfServiceFn()!;
    const setClause =
      fn.match(
        /UPDATE public\.installers\s+SET\s+([\s\S]*?)\s+WHERE profile_id = auth\.uid\(\)/i,
      )?.[1] ?? '';
    expect(setClause.trim()).toBe('base_location = v_base_location');
    for (const col of ADMIN_ONLY_COLUMNS) {
      expect(setClause.includes(col)).toBe(false);
    }
  });

  it('takes no parameters other than base_location', () => {
    const signature = selfServiceFn()!.match(/installer_update_self\(([^)]*)\)/i)?.[1] ?? '';
    expect(signature).toMatch(/_base_location text/);
    for (const col of ADMIN_ONLY_COLUMNS) {
      expect(signature.includes(col)).toBe(false);
    }
  });

  it('is not callable anonymously', () => {
    const sql = allSql();
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.installer_update_self\(text\) FROM PUBLIC, anon/i,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.installer_update_self\(text\) TO authenticated/i,
    );
  });

  it('never lets app code write installer rows outside the RPC for non-admins', () => {
    const dir = join(process.cwd(), 'src');
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
      );
    const offenders = walk(dir)
      .filter((f) => /\.tsx?$/.test(f) && !f.includes('/test/'))
      .filter((f) => {
        const src = readFileSync(f, 'utf8');
        return /from\('installers'\)[\s\S]{0,120}\.update\(/.test(src);
      });
    expect(offenders).toEqual([]);
  });
});
