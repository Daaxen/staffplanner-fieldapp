import { useEffect, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { ForeignStatusBadge } from './StatusBadge';
import { countryName, projectBooking, STATUS_RANK, type ForeignDay, type ForeignRule, type FlagStatus } from '@/lib/foreignWork';
import { loadForeignDays, loadRules, loadInstallerLite, defaultFactWindow, todayISO } from '@/lib/foreignWork/data';
import { countryFromText } from '@/lib/perDiem';

const NAME_TO_ISO: Record<string, string> = { Sverige: 'SE', Norge: 'NO', Finland: 'FI', Danmark: 'DK', Tyskland: 'DE' };

/** Advisory only – never blocks a booking. */
export default function ForeignBookingWarning({ country, assignees }: { country?: string | null; assignees: { id: string; name: string; start?: string | null; end?: string | null }[] }) {
  const [state, setState] = useState<{ days: ForeignDay[]; rules: ForeignRule[]; homes: Record<string, string | null> } | null>(null);
  const iso = country ? (NAME_TO_ISO[country] ?? NAME_TO_ISO[countryFromText(country) ?? ''] ?? (/^[A-Z]{2}$/.test(country) ? country : null)) : null;
  const key = assignees.map(a => a.id).join(',');
  useEffect(() => {
    if (!iso || !assignees.length) return;
    const w = defaultFactWindow();
    Promise.all([loadForeignDays(w.from, w.to), loadRules(), loadInstallerLite()])
      .then(([days, rules, ins]) => setState({ days, rules, homes: Object.fromEntries(ins.map(i => [i.id, i.home_country])) }))
      .catch(() => setState(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, key]);
  if (!iso || !state || !state.rules.length) return null;
  const asOf = todayISO();
  const items = assignees.map(a => {
    const home = state.homes[a.id];
    if (home === undefined) return null;
    if (home === iso) return null; // domestic
    const mine = state.days.filter(d => d.installer_id === a.id);
    const res = state.rules.map(r => home ? projectBooking(r, iso, mine, asOf, { installer_id: a.id, start: a.start, end: a.end }) : { current: { value: null }, added: null, projected: null, status: 'NOT_VERIFIED' as FlagStatus, rule: r }).filter(Boolean) as any[];
    if (!res.length) return null;
    const worst = res.reduce((w, r) => (STATUS_RANK[r.status as FlagStatus] > STATUS_RANK[w.status as FlagStatus] ? r : w));
    return { a, worst };
  }).filter(Boolean) as { a: typeof assignees[number]; worst: any }[];
  const shown = items.filter(i => i.worst.status !== 'NORMAL');
  if (!shown.length) return null;
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="text-xs font-semibold flex items-center gap-1.5"><Globe2 className="w-3.5 h-3.5" /> UTLANDSARBETE – {countryName(iso)}</p>
      {shown.map(({ a, worst }) => (
        <div key={a.id} className="text-xs space-y-0.5">
          <div className="flex items-center justify-between"><span className="font-medium">{a.name}</span><ForeignStatusBadge status={worst.status} /></div>
          {worst.status === 'NOT_VERIFIED'
            ? <p className="text-muted-foreground">Prognos ej verifierad – hemland eller datum saknas.</p>
            : <p>Nuvarande: {worst.current.value} dagar · Denna bokning: {worst.added} dagar · Prognos: {worst.projected} dagar ({worst.current.rule.name})</p>}
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">Varningen är rådgivande och stoppar inte bokningen.</p>
    </div>
  );
}
