import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { ForeignStatusBadge } from './StatusBadge';
import { COUNTRY_NAMES, countryName, summarizeInstaller, docStatus, DOC_STATUS_LABEL, METRIC_LABEL, WINDOW_LABEL, VERIFICATION_LABEL, worstStatus, type ForeignDay, type ForeignRule } from '@/lib/foreignWork';
import { loadForeignDays, loadRules, loadDocs, loadPeriods, defaultFactWindow, todayISO, docForCountry, type ForeignDoc, type ForeignPeriod } from '@/lib/foreignWork/data';

/** "UTLANDSARBETE" block on the admin installer card. Pass installerId or profileId. */
export default function ForeignWorkSection({ profileId, installerId: givenId, canEdit = true }: { profileId?: string; installerId?: string; canEdit?: boolean }) {
  const [inst, setInst] = useState<{ id: string; home_country: string | null } | null>(null);
  const [days, setDays] = useState<ForeignDay[]>([]);
  const [rules, setRules] = useState<ForeignRule[]>([]);
  const [docs, setDocs] = useState<ForeignDoc[]>([]);
  const [periods, setPeriods] = useState<ForeignPeriod[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const asOf = todayISO();

  const load = async () => {
    setLoading(true);
    const q = (supabase as any).from('installers').select('id,home_country');
    const { data } = givenId ? await q.eq('id', givenId).maybeSingle() : await q.eq('profile_id', profileId).maybeSingle();
    setInst(data ?? null);
    if (data) {
      const w = defaultFactWindow(asOf);
      const [d, r, dc, p] = await Promise.all([loadForeignDays(w.from, w.to, data.id).catch(() => []), loadRules().catch(() => []), loadDocs(data.id), loadPeriods(data.id)]);
      setDays(d); setRules(r); setDocs(dc); setPeriods(p);
    }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profileId, givenId]);

  const year = { from: `${asOf.slice(0, 4)}-01-01`, to: `${asOf.slice(0, 4)}-12-31` };
  const summary = useMemo(() => inst ? summarizeInstaller(inst.id, days, rules, year, asOf, !!inst.home_country) : [], [inst, days, rules]);

  const setHome = async (v: string) => {
    if (!inst) return;
    const { error } = await (supabase as any).rpc('set_installer_home_country', { _installer_id: inst.id, _country: v === 'none' ? null : v });
    if (error) toast.error(error.message); else { toast.success('Hemland sparat'); load(); }
  };

  if (loading) return <div className="rounded-lg border p-4 text-xs text-muted-foreground">Laddar utlandsarbete…</div>;
  if (!inst) return null;
  const overall = inst.home_country ? worstStatus(summary.map(s => ({ status: s.status } as any))) : 'NOT_VERIFIED';
  const totalWork = summary.reduce((a, s) => a + s.counter.work, 0);
  const totalPresence = summary.reduce((a, s) => a + s.counter.presence, 0);
  const latest = summary.map(s => s.counter.last).filter(Boolean).sort().pop();

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold flex items-center gap-2"><Globe2 className="w-4 h-4" /> UTLANDSARBETE</p>
        <ForeignStatusBadge status={overall} />
      </div>
      <div className="flex items-end gap-3">
        <div className="space-y-1 w-48">
          <Label className="text-xs">Hemland (jämförelseland)</Label>
          <Select value={inst.home_country ?? 'none'} onValueChange={setHome} disabled={!canEdit}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Ej angivet —</SelectItem>
              {Object.entries(COUNTRY_NAMES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {!inst.home_country && <p className="text-xs text-muted-foreground pb-1.5">Räknarna är ej verifierade tills hemland är angivet.</p>}
      </div>
      {inst.home_country && (
        <>
          <p className="text-xs text-muted-foreground">Period: kalenderår {asOf.slice(0, 4)} · Totalt {totalWork} arbetsdagar · {totalPresence} vistelsedagar{latest ? ` · Senast utomlands ${latest}` : ''}</p>
          {summary.length === 0 && <p className="text-xs text-muted-foreground">Inget utlandsarbete registrerat.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {summary.map(s => {
              const doc = docForCountry(docs, inst.id, s.country);
              return (
                <div key={s.country} className="rounded-md border p-3 space-y-1.5">
                  <div className="flex items-center justify-between"><p className="font-semibold text-sm">{countryName(s.country)}</p><ForeignStatusBadge status={s.status} /></div>
                  <p className="text-sm">Arbetsdagar: <b>{s.counter.work}</b> · Vistelsedagar: <b>{s.counter.presence}</b></p>
                  {s.next ? <p className="text-xs">Nästa gräns: {s.next.remaining} dagar kvar ({s.next.rule.name})</p> : <p className="text-xs text-muted-foreground">{rules.length ? 'Ingen kommande gräns' : 'Inga regler konfigurerade'}</p>}
                  <p className="text-xs text-muted-foreground">A1: {DOC_STATUS_LABEL[docStatus(doc, asOf)]} · {VERIFICATION_LABEL[s.counter.verification]}{s.counter.conflicts ? ` · ${s.counter.conflicts} dagar att granska` : ''}</p>
                  {s.flags.filter(f => f.status !== 'NORMAL').map(f => (
                    <p key={f.rule.id} className="text-xs border-l-2 border-primary pl-2">
                      {f.rule.name}: {METRIC_LABEL[f.rule.metric]}, {WINDOW_LABEL[f.rule.window_type]}{f.window ? ` (${f.window.from}–${f.window.to})` : ''}: {f.value ?? '–'} av {f.rule.watch_threshold}/{f.rule.review_threshold}/{f.rule.critical_threshold} · underlag {f.dayCount} dagposter
                    </p>
                  ))}
                </div>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setOpen(o => !o)}>{open ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}Historik</Button>
          {open && <ForeignHistory days={days} periods={periods} />}
        </>
      )}
    </div>
  );
}

export function ForeignHistory({ days, periods }: { days: ForeignDay[]; periods: ForeignPeriod[] }) {
  // Group consecutive days per country into trips
  const trips: { country: string; from: string; to: string; work: number; presence: number; source: string; ver: string }[] = [];
  const sorted = [...days].sort((a, b) => a.country.localeCompare(b.country) || a.day.localeCompare(b.day));
  for (const d of sorted) {
    const t = trips[trips.length - 1];
    const next = t && t.country === d.country && new Date(Date.parse(t.to) + 86400000).toISOString().slice(0, 10) === d.day;
    if (next) { t.to = d.day; t.work += d.is_work ? 1 : 0; t.presence += 1; if (d.verification === 'DERIVED') t.ver = 'DERIVED'; }
    else trips.push({ country: d.country, from: d.day, to: d.day, work: d.is_work ? 1 : 0, presence: 1, source: d.work_source ?? d.presence_source ?? '', ver: d.verification });
  }
  trips.sort((a, b) => b.from.localeCompare(a.from));
  return (
    <div className="space-y-2 text-xs">
      <table className="w-full">
        <thead className="text-muted-foreground"><tr><th className="text-left">Land</th><th className="text-left">Från</th><th className="text-left">Till</th><th>Arb.</th><th>Vist.</th><th className="text-left">Status</th></tr></thead>
        <tbody>{trips.map((t, i) => <tr key={i} className="border-t"><td>{countryName(t.country)}</td><td>{t.from}</td><td>{t.to}</td><td className="text-center">{t.work}</td><td className="text-center">{t.presence}</td><td>{VERIFICATION_LABEL[t.ver as keyof typeof VERIFICATION_LABEL]}</td></tr>)}</tbody>
      </table>
      {periods.length > 0 && <p className="font-semibold pt-2">Manuella perioder</p>}
      {periods.map(p => <p key={p.id} className={p.voided_at ? 'line-through text-muted-foreground' : ''}>{countryName(p.country)} {p.start_at.slice(0, 10)}–{p.end_at.slice(0, 10)} · {p.kind === 'work' ? 'arbete' : 'vistelse'} · ändrad {p.updated_at.slice(0, 10)}{p.voided_at ? ` · makulerad: ${p.void_reason ?? ''}` : ''}</p>)}
    </div>
  );
}
