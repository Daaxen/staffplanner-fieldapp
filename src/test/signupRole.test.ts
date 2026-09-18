import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { resolveSignupRole } from '@/lib/signupRole';

describe('signup role assignment', () => {
  it('ignores role="admin" in signup metadata', () => {
    expect(resolveSignupRole({ role: 'admin' }, false)).toBe('installer');
  });

  it('ignores every shape of privilege escalation attempt', () => {
    const attempts: unknown[] = [
      { role: 'admin' },
      { role: 'ADMIN' },
      { role: ['admin'] },
      { app_role: 'admin' },
      { roles: ['admin', 'installer'] },
      { role: { toString: () => 'admin' } },
      { 'role"' : 'admin' },
    ];
    for (const meta of attempts) {
      expect(resolveSignupRole(meta, false)).toBe('installer');
    }
  });

  it('only bootstraps admin for the very first user', () => {
    expect(resolveSignupRole({}, true)).toBe('admin');
    expect(resolveSignupRole({ role: 'installer' }, false)).toBe('installer');
  });

  it('does not break on invalid or missing metadata', () => {
    const invalid: unknown[] = [null, undefined, '', 'admin', 0, NaN, [], {}, { role: null }, { role: 12 }];
    for (const meta of invalid) {
      expect(() => resolveSignupRole(meta, false)).not.toThrow();
      expect(resolveSignupRole(meta, false)).toBe('installer');
    }
  });
});

const latestTriggerSql = () => {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (let i = files.length - 1; i >= 0; i -= 1) {
    const sql = readFileSync(join(dir, files[i]), 'utf8');
    if (sql.includes('FUNCTION public.handle_new_user')) return sql;
  }
  throw new Error('handle_new_user migration not found');
};

describe('handle_new_user trigger', () => {
  it('never reads a role from signup metadata', () => {
    const sql = latestTriggerSql();
    const roleFromMetadata = /raw_user_meta_data\s*->>\s*'role'/i;
    expect(roleFromMetadata.test(sql)).toBe(false);
    expect(sql).toMatch(/v_role\s*:=\s*'installer'/);
  });

  it('keeps the first-admin bootstrap independent of metadata', () => {
    expect(latestTriggerSql()).toMatch(/NOT EXISTS \(SELECT 1 FROM public\.user_roles\)/);
  });
});
