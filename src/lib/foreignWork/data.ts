import { supabase } from '@/integrations/supabase/client';
import type { ForeignDay, ForeignRule } from './index';
import { addDays } from './index';

const db = supabase as any;
export const todayISO = () => new Date().toISOString().slice(0, 10);

/** One call for all installers (no N+1). Covers rolling 12 months + current and previous calendar year. */
export function defaultFactWindow(asOf = todayISO()) {
  return { from: `${+asOf.slice(0, 4) - 1}-01-01`, to: addDays(asOf, 400) };
}

export async function loadForeignDays(from: string, to: string, installerId?: string | null): Promise<ForeignDay[]> {
  const { data, error } = await db.rpc('foreign_work_days', { _from: from, _to: to, _installer_id: installerId ?? null });
  if (error) throw error;
  return (data ?? []) as ForeignDay[];
}

export async function loadRules(): Promise<ForeignRule[]> {
  const { data, error } = await db.from('foreign_work_rules').select('*').order('created_at');
  if (error) throw error;
  return (data ?? []) as ForeignRule[];
}

export interface ForeignDoc { id: string; installer_id: string; doc_type: string; countries: string[]; valid_from: string | null; valid_to: string | null; status: any; reference_number: string | null; notes: string | null; voided_at: string | null }
export async function loadDocs(installerId?: string): Promise<ForeignDoc[]> {
  let q = db.from('foreign_work_documents').select('id,installer_id,doc_type,countries,valid_from,valid_to,status,reference_number,notes,voided_at').is('voided_at', null);
  if (installerId) q = q.eq('installer_id', installerId);
  const { data, error } = await q;
  if (error) return [];
  return data ?? [];
}

export interface ForeignPeriod { id: string; installer_id: string; project_id: string | null; country: string; start_at: string; end_at: string; kind: string; source: string; verification_status: string; notes: string | null; voided_at: string | null; void_reason: string | null; updated_at: string }
export async function loadPeriods(installerId?: string): Promise<ForeignPeriod[]> {
  let q = db.from('foreign_work_periods').select('*').order('start_at', { ascending: false });
  if (installerId) q = q.eq('installer_id', installerId);
  const { data, error } = await q;
  if (error) return [];
  return data ?? [];
}

export async function loadInstallerLite(): Promise<{ id: string; name: string; type: string; home_country: string | null; profile_id: string | null; sandbox: boolean }[]> {
  const { data } = await db.from('installers').select('id,name,type,home_country,profile_id,sandbox').order('name');
  return data ?? [];
}

export const docForCountry = (docs: ForeignDoc[], installerId: string, country: string) =>
  docs.filter(d => d.installer_id === installerId && d.doc_type === 'A1' && (d.countries.length === 0 || d.countries.includes(country)))
    .sort((a, b) => (b.valid_to ?? '').localeCompare(a.valid_to ?? ''))[0] ?? null;
