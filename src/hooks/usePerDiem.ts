import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DOMESTIC } from '@/lib/perDiem';

export type PerDiemRate = { year: number; country: string; full_day: number };
export type PerDiemEntry = {
  id: string; project_id: string; installer_id: string; entry_date: string; country: string;
  day_type: 'full' | 'half' | 'none'; overnight: 'hotel' | 'private' | 'none';
  breakfast_provided: boolean; lunch_provided: boolean; dinner_provided: boolean;
  distance_confirmed: boolean; note: string | null; rate_year: number | null;
  full_day_rate: number; day_amount: number; night_amount: number; amount: number;
};

let ratesCache: PerDiemRate[] | null = null;
export function usePerDiemRates() {
  const [rates, setRates] = useState<PerDiemRate[]>(ratesCache ?? []);
  useEffect(() => {
    if (ratesCache) return;
    void supabase.from('per_diem_rates').select('year,country,full_day').order('country').then(({ data }) => {
      ratesCache = (data ?? []).map(r => ({ ...r, full_day: Number(r.full_day) }));
      setRates(ratesCache);
    });
  }, []);
  return rates;
}

export function rateFor(rates: PerDiemRate[], country: string, date: string) {
  const y = Number(date.slice(0, 4));
  const list = rates.filter(r => r.country === country).sort((a, b) => b.year - a.year);
  return list.find(r => r.year <= y) ?? list[list.length - 1];
}

export function usePerDiemCountries() {
  const rates = usePerDiemRates();
  const names = Array.from(new Set(rates.map(r => r.country))).filter(c => c !== DOMESTIC).sort((a, b) => a.localeCompare(b, 'sv'));
  return [DOMESTIC, ...names];
}

/** Per diem rows for one order. installerId limits to one person (installer app). */
export function usePerDiemEntries(projectId: string, installerId?: string) {
  const [entries, setEntries] = useState<PerDiemEntry[]>([]);
  const load = useCallback(async () => {
    let q = supabase.from('per_diem_entries').select('*').eq('project_id', projectId).order('entry_date');
    if (installerId) q = q.eq('installer_id', installerId);
    const { data } = await q;
    setEntries((data ?? []).map(e => ({ ...e, amount: Number(e.amount), day_amount: Number(e.day_amount), night_amount: Number(e.night_amount), full_day_rate: Number(e.full_day_rate) })) as PerDiemEntry[]);
  }, [projectId, installerId]);
  useEffect(() => { void load(); }, [load]);
  return { entries, reload: load };
}
