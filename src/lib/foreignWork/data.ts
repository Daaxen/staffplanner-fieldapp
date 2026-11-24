import { supabase } from '@/integrations/supabase/client';
import type { ForeignDay, ForeignRule } from './index';
import { ruleWindow, addDays, daysBetweenInclusive } from './index';

const db = supabase as any;
export const todayISO = () => new Date().toISOString().slice(0, 10);

/** One call for all installers (no N+1). Covers rolling 12 months + current and previous calendar year. */
export function defaultFactWindow(asOf = todayISO()) {
  return { from: `${+asOf.slice(0, 4) - 1}-01-01`, to: asOf };
}

export function factWindowForRules(rules: ForeignRule[], period: { from: string; to: string }, asOf = todayISO()) {
  const windows = rules.filter(r => r.enabled).map(r => ruleWindow(r, asOf)).filter(w => w != null);
  const end = [period.to, ...windows.map(w=>w.to)].sort().pop() ?? period.to;
  return { from: [period.from, ...windows.map(w => w.from)].sort()[0] ?? period.from, to: end < asOf ? end : asOf };
}

export async function loadForeignDays(from: string, to: string, installerId?: string | null): Promise<ForeignDay[]> {
  if (from > to) return [];
  if (daysBetweenInclusive(from,to)>1101) {
    const firstEnd=addDays(from,1100);
    const [first,rest]=await Promise.all([loadForeignDays(from,firstEnd,installerId),loadForeignDays(addDays(firstEnd,1),to,installerId)]);
    return [...first,...rest];
  }
  const { data, error } = await db.rpc('foreign_work_days', { _from: from, _to: to, _installer_id: installerId ?? null });
  if (error) throw error;
  return (data ?? []) as ForeignDay[];
}

export async function loadRules(internal = false): Promise<ForeignRule[]> {
  const { data, error } = await db.rpc('foreign_work_rule_data', { _internal: internal });
  if (error) throw error;
  return (data ?? []) as ForeignRule[];
}

export interface ForeignDoc { id: string; installer_id: string; doc_type: string; countries: string[]; valid_from: string | null; valid_to: string | null; status: any; reference_number: string | null; notes: string | null; voided_at: string | null; expiry_warning_days?: number }
export async function loadDocs(installerId?: string): Promise<ForeignDoc[]> {
  if (installerId) {
    const { data, error } = await db.rpc('foreign_work_my_documents', {_installer_id: installerId});
    if (error) throw error;
    return data ?? [];
  }
  let q = db.from('foreign_work_documents').select('id,installer_id,doc_type,countries,valid_from,valid_to,status,reference_number,notes,voided_at,expiry_warning_days').is('voided_at', null);
  if (installerId) q = q.eq('installer_id', installerId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export interface ForeignPeriod { id: string; installer_id: string; project_id: string | null; country: string; start_at: string; end_at: string; kind: string; source: string; verification_status: string; notes: string | null; voided_at: string | null; void_reason: string | null; updated_at: string }
export async function loadPeriods(installerId?: string): Promise<ForeignPeriod[]> {
  let q = db.from('foreign_work_periods').select('id,installer_id,project_id,country,start_at,end_at,kind,source,verification_status,notes,voided_at,void_reason,updated_at').order('start_at', { ascending: false });
  if (installerId) q = q.eq('installer_id', installerId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function loadInstallerLite(): Promise<{ id: string; name: string; type: string; home_country: string | null; sandbox: boolean }[]> {
  const { data, error } = await db.rpc('foreign_work_installers');
  if (error) throw error;
  return (data ?? []).sort((a: {name: string}, b: {name: string}) => a.name.localeCompare(b.name));
}

export const docForCountry = (docs: ForeignDoc[], installerId: string, country: string) =>
  docs.filter(d => d.installer_id === installerId && d.doc_type === 'A1' && (d.countries.length === 0 || d.countries.includes(country)))
    .sort((a, b) => (b.valid_to ?? '').localeCompare(a.valid_to ?? ''))[0] ?? null;
