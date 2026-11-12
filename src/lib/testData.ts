import { supabase } from '@/integrations/supabase/client';

/**
 * Test data (installers/projects/clients with sandbox = true) is hidden from
 * every report and register. It is shown only when a superuser turns on
 * "Visa testdata", or when the signed-in user is a test installer themselves.
 */
const KEY = 'fetch.showTestData';
export const testDataToggled = () => typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
export const setTestDataToggled = (on: boolean) => { localStorage.setItem(KEY, on ? '1' : '0'); };

export type SandboxIds = { installers: Set<string>; projects: Set<string>; clients: Set<string>; clientRefs: Set<string>; projectRefs: Set<string>; include: boolean };
let cache: Promise<SandboxIds> | null = null;

export function getSandboxIds(): Promise<SandboxIds> {
  if (cache) return cache;
  cache = (async () => {
    const [i, p, c, me] = await Promise.all([
      supabase.from('installers').select('id').eq('sandbox', true),
      supabase.from('projects').select('id,ref').eq('sandbox', true),
      supabase.from('clients').select('id,ref').eq('sandbox', true),
      supabase.rpc('current_installer_id'),
    ]);
    const installers = new Set((i.data ?? []).map(r => r.id as string));
    const own = me.data as string | null;
    return {
      installers,
      projects: new Set((p.data ?? []).map(r => r.id as string)),
      projectRefs: new Set((p.data ?? []).map(r => (r as { ref: string | null }).ref).filter(Boolean) as string[]),
      clients: new Set((c.data ?? []).map(r => r.id as string)),
      clientRefs: new Set((c.data ?? []).map(r => (r as { ref: string | null }).ref).filter(Boolean) as string[]),
      include: testDataToggled() || (!!own && installers.has(own)),
    };
  })();
  return cache;
}

type Linked = { installer_id?: string | null; project_id?: string | null; client_id?: string | null };
export const isTestRow = (s: SandboxIds, r: Linked) =>
  (!!r.installer_id && s.installers.has(r.installer_id)) ||
  (!!r.project_id && s.projects.has(r.project_id)) ||
  (!!r.client_id && s.clients.has(r.client_id));

/** Drops rows linked to test installers/orders/clients unless test data is shown. */
export async function withoutTestRows<T extends Linked>(rows: T[]): Promise<T[]> {
  const s = await getSandboxIds();
  return s.include ? rows : rows.filter(r => !isTestRow(s, r));
}
/** Same for lists of the entities themselves (by id). */
export async function withoutTestIds<T extends { id: string }>(rows: T[], kind: 'installers' | 'projects' | 'clients'): Promise<T[]> {
  const s = await getSandboxIds();
  return s.include ? rows : rows.filter(r => !s[kind].has(r.id));
}
