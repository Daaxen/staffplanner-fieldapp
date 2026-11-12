import { useEffect, useMemo, useState } from 'react';
import { BedDouble, Lock, Trash2, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useMyInstallerId } from '@/lib/installerIdentity';
import { usePerDiemEntries, usePerDiemRates, rateFor } from '@/hooks/usePerDiem';
import { DOMESTIC, perDiemAmount, type DayType, type Meals, type Overnight } from '@/lib/perDiem';
import { TIME_LOCKED_MESSAGE } from '@/lib/timeReporting';
import { cn } from '@/lib/utils';

type Props = { projectId: string; country?: string; date: string; locked: boolean };

const kr = (n: number) => `${n.toLocaleString('sv-SE')} kr`;
const MEALS: { key: keyof Meals; label: string }[] = [
  { key: 'breakfast', label: 'Frukost' }, { key: 'lunch', label: 'Lunch' }, { key: 'dinner', label: 'Middag' },
];

const Choice = ({ active, onClick, children, tone = 'blue' }: { active: boolean; onClick: () => void; children: React.ReactNode; tone?: 'blue' | 'green' | 'yellow' }) => (
  <Button type="button" variant="outline" onClick={onClick}
    className={cn('h-auto py-2 font-bold whitespace-normal', active && tone === 'blue' && 'bg-status-scheduled text-primary-foreground border-status-scheduled hover:bg-status-scheduled/90',
      active && tone === 'green' && 'bg-status-completed text-primary-foreground border-status-completed hover:bg-status-completed/90',
      active && tone === 'yellow' && 'bg-status-in-progress text-foreground border-status-in-progress hover:bg-status-in-progress/90')}>
    {children}
  </Button>
);

const PerDiemSection = ({ projectId, country: orderCountry, date, locked }: Props) => {
  const { installerId } = useMyInstallerId();
  const rates = usePerDiemRates();
  const { entries, reload } = usePerDiemEntries(projectId, installerId ?? undefined);
  const existing = entries.find(e => e.entry_date === date);
  const [country, setCountry] = useState(orderCountry || DOMESTIC);
  const [dayType, setDayType] = useState<DayType>('full');
  const [overnight, setOvernight] = useState<Overnight>('hotel');
  const [meals, setMeals] = useState<Meals>({ breakfast: false, lunch: false, dinner: false });
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCountry(existing?.country ?? orderCountry ?? DOMESTIC);
    setDayType(existing?.day_type ?? 'full');
    setOvernight(existing?.overnight ?? 'hotel');
    setMeals({ breakfast: !!existing?.breakfast_provided, lunch: !!existing?.lunch_provided, dinner: !!existing?.dinner_provided });
    setConfirmed(!!existing?.distance_confirmed);
  }, [existing?.id, date, orderCountry]); // eslint-disable-line react-hooks/exhaustive-deps

  const rate = rateFor(rates, country, date);
  const preview = useMemo(() => rate ? perDiemAmount({ fullDayRate: rate.full_day, country, dayType, overnight, meals }) : null, [rate, country, dayType, overnight, meals]);
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const foreign = country !== DOMESTIC;

  const save = async () => {
    if (!installerId) return;
    if (!confirmed) { toast.error('Bekräfta att resan är över 50 km och med övernattning'); return; }
    setSaving(true);
    const { error } = await supabase.from('per_diem_entries').upsert({
      project_id: projectId, installer_id: installerId, entry_date: date, country, day_type: dayType, overnight,
      breakfast_provided: meals.breakfast, lunch_provided: meals.lunch, dinner_provided: meals.dinner, distance_confirmed: confirmed,
    }, { onConflict: 'project_id,installer_id,entry_date' });
    setSaving(false);
    if (error) { toast.error(error.message.includes('TIME_LOCKED') ? TIME_LOCKED_MESSAGE : 'Traktamentet kunde inte sparas'); return; }
    toast.success(`Traktamente sparat för ${date}`);
    void reload();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('per_diem_entries').delete().eq('id', id);
    if (error) { toast.error(error.message.includes('TIME_LOCKED') ? TIME_LOCKED_MESSAGE : 'Kunde inte ta bort'); return; }
    void reload();
  };

  return (
    <section className={cn('rounded-lg border border-border border-l-4 bg-card p-3 space-y-3', existing ? 'border-l-status-completed' : 'border-l-status-scheduled')}>
      <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><BedDouble className="w-4 h-4" />Traktamente & logi · {date}</h2>

      <div className={cn('rounded-md p-2 text-sm', foreign ? 'bg-status-scheduled/10 text-status-scheduled' : 'bg-muted text-foreground')}>
        <p className="font-bold">{foreign ? `Utlandstraktamente: ${country}` : 'Inrikes traktamente'}</p>
        <p className="text-xs">{rate ? `${kr(rate.full_day)} per heldag · Skatteverket ${rate.year}` : 'Belopp saknas för landet'}</p>
      </div>

      {locked ? (
        <p className="flex items-center gap-2 text-sm text-foreground"><Lock className="w-4 h-4" />{TIME_LOCKED_MESSAGE}</p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-xs font-bold text-muted-foreground">Typ av dag</p>
            <div className="grid grid-cols-3 gap-2">
              <Choice active={dayType === 'full'} onClick={() => setDayType('full')}>Heldag</Choice>
              <Choice active={dayType === 'half'} onClick={() => setDayType('half')}>Halvdag</Choice>
              <Choice active={dayType === 'none'} onClick={() => setDayType('none')}>Inget</Choice>
            </div>
            <p className="text-[11px] text-muted-foreground">Halvdag = avresa kl 12 eller senare, eller hemma senast kl 19.</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-muted-foreground">Övernattning natten efter</p>
            <div className="grid grid-cols-3 gap-2">
              <Choice active={overnight === 'hotel'} onClick={() => setOvernight('hotel')}>Hotell</Choice>
              <Choice active={overnight === 'private'} onClick={() => setOvernight('private')}>Privat logi</Choice>
              <Choice active={overnight === 'none'} onClick={() => setOvernight('none')}>Ingen</Choice>
            </div>
            {overnight === 'hotel' && <p className="text-[11px] text-muted-foreground">Hotellkostnaden lägger du som utlägg "Logi (hotell)" med kvitto nedan.</p>}
            {overnight === 'private' && <p className="text-[11px] text-muted-foreground">Ger nattraktamente när ingen har betalat boendet.</p>}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground flex items-center gap-1"><UtensilsCrossed className="w-3.5 h-3.5" />Måltider – vem betalade?</p>
            {overnight === 'hotel' && (
              <div className="rounded-md border border-border p-2 space-y-1">
                <p className="text-sm font-semibold">Ingick frukost i hotellet?</p>
                <div className="grid grid-cols-2 gap-2">
                  <Choice tone="yellow" active={meals.breakfast} onClick={() => setMeals(m => ({ ...m, breakfast: true }))}>Ja, ingick</Choice>
                  <Choice tone="green" active={!meals.breakfast} onClick={() => setMeals(m => ({ ...m, breakfast: false }))}>Nej</Choice>
                </div>
              </div>
            )}
            {MEALS.filter(m => !(overnight === 'hotel' && m.key === 'breakfast')).map(m => (
              <div key={m.key} className="rounded-md border border-border p-2 space-y-1">
                <p className="text-sm font-semibold">{m.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Choice tone="green" active={!meals[m.key]} onClick={() => setMeals(x => ({ ...x, [m.key]: false }))}>Jag betalade själv</Choice>
                  <Choice tone="yellow" active={meals[m.key]} onClick={() => setMeals(x => ({ ...x, [m.key]: true }))}>Bjuden / betald av kund eller företag</Choice>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">Bjuden måltid minskar traktamentet. Har du betalat mat åt kund eller kollegor? Lägg det som utlägg "Meal".</p>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={v => setConfirmed(v === true)} className="mt-0.5" />
            <span>Resan är mer än 50 km från hemmet och vanliga arbetsplatsen, och jag övernattar.</span>
          </label>

          {preview && (
            <div className="rounded-md bg-status-completed/10 p-2 text-sm">
              <p className="font-bold text-status-completed">{kr(preview.total)} skattefritt</p>
              <p className="text-xs text-muted-foreground">
                {dayType === 'none' ? 'Ingen dagersättning' : `${dayType === 'full' ? 'Heldag' : 'Halvdag'} ${kr(Math.round(rate!.full_day * (dayType === 'full' ? 1 : 0.5)))}`}
                {preview.reductionPct ? ` − måltider ${preview.reductionPct} %` : ''}
                {preview.night ? ` + nattraktamente ${kr(preview.night)}` : ''}
              </p>
            </div>
          )}

          <Button className="w-full font-bold bg-status-completed text-primary-foreground hover:bg-status-completed/90" disabled={saving || !rate} onClick={() => void save()}>
            {existing ? 'Uppdatera' : 'Spara'} traktamente för {date}
          </Button>
        </>
      )}

      {entries.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {entries.map(e => (
            <div key={e.id} className="flex items-center gap-2 rounded-md border border-border border-l-4 border-l-status-completed p-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{e.entry_date} · {kr(e.amount)}</p>
                <p className="text-xs text-muted-foreground">
                  {e.country} · {e.day_type === 'full' ? 'Heldag' : e.day_type === 'half' ? 'Halvdag' : 'Ingen dag'}
                  {e.overnight === 'hotel' ? ' · Hotell' : e.overnight === 'private' ? ' · Privat logi' : ''}
                  {[e.breakfast_provided && 'frukost', e.lunch_provided && 'lunch', e.dinner_provided && 'middag'].filter(Boolean).length
                    ? ` · bjuden: ${[e.breakfast_provided && 'frukost', e.lunch_provided && 'lunch', e.dinner_provided && 'middag'].filter(Boolean).join(', ')}` : ''}
                </p>
              </div>
              {!locked && <Button variant="ghost" size="icon" aria-label="Ta bort traktamente" onClick={() => void remove(e.id)}><Trash2 className="w-4 h-4" /></Button>}
            </div>
          ))}
          <p className="text-right text-sm font-bold">Totalt: {kr(total)}</p>
        </div>
      )}
    </section>
  );
};

export default PerDiemSection;
