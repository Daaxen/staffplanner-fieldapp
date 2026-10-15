import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isBlockedWrite } from '@/lib/readOnlyGuard';
import { isReadOnlyView } from '@/lib/viewAs';

const sql = readdirSync(join(process.cwd(), 'drizzle', 'migrations'))
  .filter(f => f.endsWith('.sql'))
  .map(f => readFileSync(join(process.cwd(), 'drizzle', 'migrations', f), 'utf8'))
  .join('\n');

describe('superuser role (database)', () => {
  it('only a superuser may grant or remove superuser', () => {
    expect(sql).toMatch(/_role = 'superuser' AND NOT public\.has_role\(auth\.uid\(\), 'superuser'\)/);
  });
  it('the last superuser cannot be removed', () => {
    expect(sql).toMatch(/The last superuser cannot be removed/);
  });
  it('superuser inherits admin and HR', () => {
    expect(sql).toMatch(/role = 'superuser' AND _role IN \('admin','hr'\)/);
  });
});

describe('view as installer is read-only', () => {
  const rest = 'https://x.supabase.co/rest/v1/time_entries';
  it('blocks every write while viewing as another installer', () => {
    expect(isBlockedWrite(rest, 'POST')).toBe(true);
    expect(isBlockedWrite(rest, 'PATCH')).toBe(true);
    expect(isBlockedWrite(rest, 'DELETE')).toBe(true);
    expect(isBlockedWrite('https://x.supabase.co/storage/v1/object/field-photos/a.jpg', 'POST')).toBe(true);
  });
  it('still allows reading', () => {
    expect(isBlockedWrite(rest, 'GET')).toBe(false);
    expect(isBlockedWrite('https://x.supabase.co/rest/v1/rpc/log_view_as', 'POST')).toBe(false);
  });
  it('is read-only only for a superuser looking at someone', () => {
    expect(isReadOnlyView({ mode: 'installer', installerId: 'i1', installerName: 'Thea' }, true)).toBe(true);
    expect(isReadOnlyView({ mode: 'installer', installerId: null, installerName: null }, true)).toBe(false);
    expect(isReadOnlyView({ mode: 'installer', installerId: 'i1', installerName: 'Thea' }, false)).toBe(false);
  });
});
