import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Pencil, Plus, Trash2, CalendarPlus, Building } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useMyInstallerId } from '@/lib/installerIdentity';
import { useTimeReportingRefs, useTimeRows } from '@/hooks/useTimeReporting';
import {
  INTERNAL_CUSTOMER_NUMBER, INTERNAL_HELP, NORMAL_DAY_HOURS, clientLabel, isoDate, rowHours, validateRow, weekDays,
  type TimeRow,
} from '@/lib/timeReporting';

type Draft = {
  id?: string; date: string; clientId: string; projectGroupId: string; orderId: string;
  activityTypeId: string; hours: string; description: string; sourceAssignmentId?: string | null;
};
const NONE = '__none';
const fmt = (h: number) => h.toFixed(2).replace('.', ',').replace(/,00$/, '');
const dayName = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });

export default function MyTime() {
  const { installerId, checked } = useMyInstallerId();
  const refs = useTimeReportingRefs();
  const [date, setDate] = useState(isoDate(new Date()));
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const week = useMemo(() => weekDays(date), [date]);
  const { rows, reload } = useTimeRows({ from: week[0], to: week[6], installerId: installerId ?? '00000000-0000-0000-0000-000000000000' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [bookings, setBookings] = useState<{ id: string; project_id: string }[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    if (!installerId) return;
    supabase.from('assignments').select('id,project_id,planned_start_at,planned_end_at')
      .eq('installer_id', installerId).lte('planned_start_at', `${date}T23:59:59`).gte('planned_end_at', `${date}T00:00:00`)
      .then(({ data }) => setBookings((data ?? []) as { id: string; project_id: string }[]));
  }, [installerId, date]);

  const dayRows = rows.filter(r => r.entry_date === date);
  const dayTotal = dayRows.reduce((s, r) => s + rowHours(r), 0);
  const internal = refs.clients.find(c => c.customer_number === INTERNAL_CUSTOMER_NUMBER);
  const byId = <T extends { id: string }>(list: T[], id?: string | null) => list.find(x => x.id === id);

  const blank = (extra: Partial<Draft> = {}): Draft => ({ date, clientId: '', projectGroupId: '', orderId: '', activityTypeId: '', hours: '', description: '', ...extra });
  const fromRow = (r: TimeRow, copy = false): Draft => ({
    id: copy ? undefined : r.id, date: copy ? date : r.entry_date, clientId: r.client_id ?? '', projectGroupId: r.project_group_id ?? '',
    orderId: r.project_id ?? '', activityTypeId: r.activity_type_id ?? '', hours: String(r.hours), description: r.description ?? r.note ?? '',
  });

  const fromBooking = (b: { id: string; project_id: string }) => {
    const o = byId(refs.orders, b.project_id);
    setDraft(blank({ clientId: o?.client_id ?? '', projectGroupId: o?.project_group_id ?? '', orderId: b.project_id, sourceAssignmentId: b.id }));
    setBookingOpen(false);
  };

  const save = async () => {
    if (!draft || saving) return;
    const hours = Number(draft.hours.replace(',', '.'));
    const other = rows.filter(r => r.entry_date === draft.date && r.id !== draft.id).reduce((s, r) => s + rowHours(r), 0);
    const err = validateRow(
      { date: draft.date, clientId: draft.clientId, projectGroupId: draft.projectGroupId || null, orderId: draft.orderId || null,
        activityTypeId: draft.activityTypeId, hours, description: draft.description },
      { ...refs, otherHoursThatDay: other },
    );
    if (err) { toast.error(err); return; }
    if (!installerId) { toast.error('Du saknar en medarbetarprofil'); return; }
    setSaving(true);
    const payload = {
      entry_date: draft.date, client_id: draft.clientId, project_group_id: draft.projectGroupId || null,
      project_id: draft.orderId || null, activity_type_id: draft.activityTypeId, hours,
      description: draft.description.trim() || null, note: draft.description.trim() || null,
    };
    const res = draft.id
      ? await supabase.from('time_entries').update(payload).eq('id', draft.id)
      : await supabase.from('time_entries').insert({ ...payload, installer_id: installerId, source: 'manual', travel_hours: 0, source_assignment_id: draft.sourceAssignmentId ?? null });
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success('Tidsraden sparades');
    setDraft(null);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm('Ta bort tidsraden?')) return;
    const { error } = await supabase.from('time_entries').delete().eq('id', id);
    if (error) toast.error(error.message); else reload();
  };

  const shift = (days: number) => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + days); setDate(isoDate(d)); };
  const selClient = byId(refs.clients, draft?.clientId);
  const isInternal = selClient?.customer_number === INTERNAL_CUSTOMER_NUMBER;

  if (checked && !installerId) return <div className="p-6 text-sm text-muted-foreground">Ditt konto saknar en medarbetarprofil. Kontakta en administratör.</div>;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Min tid</h1>
          <Tabs value={mode} onValueChange={v => setMode(v as 'day' | 'week')}>
            <TabsList><TabsTrigger value="day">Dag</TabsTrigger><TabsTrigger value="week">Vecka</TabsTrigger></TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(mode === 'day' ? -1 : -7)} aria-label="Föregående"><ChevronLeft className="w-4 h-4" /></Button>
          <Input type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className="flex-1" />
          <Button variant="outline" size="icon" onClick={() => shift(mode === 'day' ? 1 : 7)} aria-label="Nästa"><ChevronRight className="w-4 h-4" /></Button>
        </div>

        {mode === 'week' ? (
          <div className="rounded-md border border-border divide-y divide-border">
            {week.map(d => {
              const h = rows.filter(r => r.entry_date === d).reduce((s, r) => s + rowHours(r), 0);
              return (
                <button key={d} onClick={() => { setDate(d); setMode('day'); }} className="w-full flex justify-between px-3 py-2 text-sm hover:bg-muted text-left">
                  <span className="capitalize">{dayName(d)}</span>
                  <span className={h === 0 ? 'text-destructive' : 'font-medium'}>{h === 0 ? 'Ingen tid' : `${fmt(h)} h`}</span>
                </button>
              );
            })}
            <div className="flex justify-between px-3 py-2 text-sm font-semibold bg-muted/50">
              <span>Veckans total</span><span>{fmt(rows.reduce((s, r) => s + rowHours(r), 0))} h</span>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-border p-3"><div className="text-xs text-muted-foreground">Dagens total</div><div className="text-2xl font-semibold">{fmt(dayTotal)} h</div></div>
              <div className="rounded-md border border-border p-3"><div className="text-xs text-muted-foreground">Tidsrader</div><div className="text-2xl font-semibold">{dayRows.length}</div></div>
              <div className="rounded-md border border-border p-3"><div className="text-xs text-muted-foreground">Mot normaldag ({NORMAL_DAY_HOURS} h)</div><div className="text-2xl font-semibold">{dayTotal - NORMAL_DAY_HOURS > 0 ? '+' : ''}{fmt(dayTotal - NORMAL_DAY_HOURS)}</div></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDraft(blank())}><Plus className="w-4 h-4 mr-1" />Ny tidsrad</Button>
              <Button variant="outline" onClick={() => setBookingOpen(true)}><CalendarPlus className="w-4 h-4 mr-1" />Från bokning</Button>
              {internal && <Button variant="outline" onClick={() => setDraft(blank({ clientId: internal.id }))}><Building className="w-4 h-4 mr-1" />Intern eller osäker kund</Button>}
            </div>
            <div className="space-y-2">
              {dayRows.length === 0 && <p className="text-sm text-muted-foreground">Ingen tid registrerad för dagen.</p>}
              {dayRows.map(r => (
                <div key={r.id} className="rounded-md border border-border p-3 flex gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{clientLabel(byId(refs.clients, r.client_id)) || 'Okänd kund'}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[byId(refs.activities, r.activity_type_id)?.name, byId(refs.groups, r.project_group_id)?.name, byId(refs.orders, r.project_id)?.name].filter(Boolean).join(' · ')}
                    </div>
                    {(r.description || r.note) && <div className="text-sm mt-1 break-words">{r.description || r.note}</div>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold">{fmt(rowHours(r))} h</div>
                    <div className="flex gap-1 mt-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Redigera" onClick={() => setDraft(fromRow(r))}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Kopiera" onClick={() => setDraft(fromRow(r, true))}><Copy className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Ta bort" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Bokningar {dayName(date)}</DialogTitle></DialogHeader>
          {bookings.length === 0 ? <p className="text-sm text-muted-foreground">Inga bokningar denna dag.</p> : (
            <div className="space-y-2">
              {bookings.map(b => {
                const o = byId(refs.orders, b.project_id);
                return (
                  <button key={b.id} onClick={() => fromBooking(b)} className="w-full text-left rounded-md border border-border p-3 hover:bg-muted">
                    <div className="font-medium">{o?.name ?? 'Order'}</div>
                    <div className="text-xs text-muted-foreground">{clientLabel(byId(refs.clients, o?.client_id))}</div>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!draft} onOpenChange={o => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{draft?.id ? 'Redigera tidsrad' : 'Ny tidsrad'}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div><Label>Datum</Label><Input type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></div>
              <div>
                <Label>Kund</Label>
                <Select value={draft.clientId || undefined} onValueChange={v => setDraft({ ...draft, clientId: v, projectGroupId: '', orderId: '' })}>
                  <SelectTrigger><SelectValue placeholder="Välj kund" /></SelectTrigger>
                  <SelectContent>{refs.clients.map(c => <SelectItem key={c.id} value={c.id}>{clientLabel(c)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Projekt (valfritt)</Label>
                <Select value={draft.projectGroupId || NONE} onValueChange={v => setDraft({ ...draft, projectGroupId: v === NONE ? '' : v, orderId: '' })} disabled={!draft.clientId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Inget projekt</SelectItem>
                    {refs.groups.filter(g => g.client_id === draft.clientId).map(g => <SelectItem key={g.id} value={g.id}>{g.project_number ? `${g.project_number} – ` : ''}{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Order (valfritt)</Label>
                <Select value={draft.orderId || NONE} onValueChange={v => setDraft({ ...draft, orderId: v === NONE ? '' : v })} disabled={!draft.clientId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Ingen order</SelectItem>
                    {refs.orders.filter(o => o.client_id === draft.clientId && (!draft.projectGroupId || o.project_group_id === draft.projectGroupId))
                      .map(o => <SelectItem key={o.id} value={o.id}>{o.project_number ? `${o.project_number} – ` : ''}{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Aktivitetstyp</Label>
                <Select value={draft.activityTypeId || undefined} onValueChange={v => setDraft({ ...draft, activityTypeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Välj aktivitet" /></SelectTrigger>
                  <SelectContent>{refs.activities.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Antal timmar</Label><Input inputMode="decimal" placeholder="t.ex. 2,5" value={draft.hours} onChange={e => setDraft({ ...draft, hours: e.target.value })} /></div>
              <div>
                <Label>Beskrivning av utfört arbete{isInternal ? ' (obligatorisk)' : ''}</Label>
                <Textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
                {isInternal && <p className="text-xs text-muted-foreground mt-1">{INTERNAL_HELP}</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Avbryt</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Sparar…' : 'Spara'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
