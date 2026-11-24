import { useEffect, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { ForeignStatusBadge } from './StatusBadge';
import { countryName, normalizeCountry, projectBooking, STATUS_RANK, type ForeignDay, type ForeignRule, type FlagStatus } from '@/lib/foreignWork';
import { loadForeignDays, loadRules, loadInstallerLite, factWindowForRules, todayISO } from '@/lib/foreignWork/data';
import type { CountryProvenance } from '@/lib/foreignWork/countries';

/** Advisory only – never blocks a booking. */
export default function ForeignBookingWarning({ country, countryProvenance = 'UNKNOWN', worksWeekends = false, assignees }: { country?: string | null; countryProvenance?: CountryProvenance; worksWeekends?: boolean; assignees: { id: string; name: string; start?: string | null; end?: string | null; presenceStart?: string; presenceEnd?: string }[] }) {
  const [state, setState] = useState<{ days: ForeignDay[]; rules: ForeignRule[]; homes: Record<string, string | null> } | null>(null);
  const iso = normalizeCountry(country);
  const key = assignees.map(a => a.id).join(',');
  useEffect(() => {
    if (!iso || !assignees.length) return;
    const asOf = todayISO();
    Promise.all([loadRules(), loadInstallerLite()])
      .then(async ([rules, ins]) => { const w = factWindowForRules(rules, {from: `${asOf.slice(0,4)}-01-01`,to:asOf}, asOf); const days = await loadForeignDays(w.from,w.to); setState({ days, rules, homes: Object.fromEntries(ins.map(i => [i.id, i.home_country])) }); })
      .catch(() => setState(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, key]);
  if (!assignees.length) return null;
  if (!iso || countryProvenance !== 'CONFIRMED') return <div className="border rounded-md p-3 text-xs text-muted-foreground">Prognos ej verifierad – destinationsland är inte bekräftat. Bokningen stoppas inte.</div>;
  if (!state || !state.rules.length) return null;
  const asOf = todayISO();
  const items = assignees.map(a => {
    const home = state.homes[a.id];
    if (home === undefined) return null;
    if (home === iso) return null; // domestic
    const mine = state.days.filter(d => d.installer_id === a.id);
    const res = state.rules.map(r => home ? projectBooking(r, iso, mine, asOf, { installer_id: a.id, start: a.start, end: a.end, worksWeekends, presenceStart: a.presenceStart, presenceEnd: a.presenceEnd }) : { current: { value: null }, added: null, projected: null, status: 'NOT_VERIFIED' as FlagStatus, rule: r }).filter(Boolean) as any[];
    if (!res.length) return null;
    const worst = res.reduce((w, r) => (STATUS_RANK[r.status as FlagStatus] > STATUS_RANK[w.status as FlagStatus] ? r : w));
    return { a, worst };
  }).filter(Boolean) as { a: typeof assignees[number]; worst: any }[];
  const shown = items.filter(i => i.worst.status !== 'NORMAL');
  if (!shown.length) return null;
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="text-xs font-semibold flex items-center gap-1.5"><Globe2 className="w-3.5 h-3.5" /> PROGNOS UTLANDSARBETE – {countryName(iso)}</p>
      {shown.map(({ a, worst }) => (
        <div key={a.id} className="text-xs space-y-0.5">
          <div className="flex items-center justify-between"><span className="font-medium">{a.name}</span><ForeignStatusBadge status={worst.status} /></div>
          {worst.status === 'NOT_VERIFIED'
            ? <p className="text-muted-foreground">Prognos ej verifierad – hemland, bekräftad vistelse eller datum saknas.</p>
            : <p>Nuvarande: {worst.current.value} dagar · Denna bokning: {worst.added} dagar · Prognos: {worst.projected} dagar ({worst.current.rule.name})</p>}
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">Beräknad bokningsperiod, inte historiska fakta. Vistelse prognostiseras endast med angivna resedatum. Varningen stoppar inte bokningen.</p>
    </div>
  );
}
