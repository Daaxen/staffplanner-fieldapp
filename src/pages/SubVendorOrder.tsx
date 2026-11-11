import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeWheel, DurationWheel } from '@/components/ui/time-wheel';
import { DEVIATION_CATEGORIES, DEVIATION_SEVERITIES } from '@/lib/deviations';
import { Input } from '@/components/ui/input';
import { Car, Receipt, CalendarDays, Camera, Clock, Lock, MapPin, Pencil, Phone, Trash2, TriangleAlert, User, Users } from 'lucide-react';
import { toast } from 'sonner';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Data = any;

const call = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke('subvendor-access', { body });
  if (error) {
    const ctx = (error as any).context;
    let msg = 'inactive';
    try { msg = (await ctx?.json())?.error ?? msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data;
};

const EXP_LABEL: Record<string, string> = { materials: 'Material', travel: 'Resa', parking: 'Parkering', meal: 'Måltid', other: 'Övrigt' };

const days = (from?: string, to?: string) => {
  const out: string[] = [];
  if (!from || !to) return out;
  for (let d = new Date(from + 'T12:00:00'); d <= new Date(to + 'T12:00:00'); d.setDate(d.getDate() + 1)) out.push(d.toLocaleDateString('sv-SE'));
  return out;
};

const Card = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border bg-card p-4 space-y-3">
    <h2 className="flex items-center gap-2 text-sm font-bold text-foreground"><Icon className="h-4 w-4 text-primary" />{title}</h2>
    {children}
  </section>
);

const SubVendorOrder = () => {
  const { token = '' } = useParams();
  const [d, setD] = useState<Data | null>(null);
  const [inactive, setInactive] = useState(false);
  const [edit, setEdit] = useState<{ id?: string; entry_date: string; start_time: string; end_time: string; travel_hours: number; note: string } | null>(null);
  const [report, setReport] = useState('');
  const [photos, setPhotos] = useState<{ path: string; url?: string }[]>([]);
  const [dev, setDev] = useState({ category: 'site-not-ready', severity: 'low', description: '' });
  const [busy, setBusy] = useState(false);
  const [mile, setMile] = useState<{ id?: string; entry_date: string; km: string; note: string } | null>(null);
  const [exp, setExp] = useState<{ id?: string; entry_date: string; category: string; amount: string; note: string; receipt_path?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await call({ action: 'get', token });
      setD(r); setReport(r.report?.report_text ?? ''); setPhotos(r.report?.photos ?? []);
    } catch { setInactive(true); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true);
    try { await call({ token, ...body }); toast.success(ok); await load(); return true; }
    catch (e) { toast.error((e as Error).message === 'inactive' ? 'Länken är inte längre aktiv' : (e as Error).message); return false; }
    finally { setBusy(false); }
  };

  const upload = async (file: File) => {
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    try {
      const { path, token: up } = await call({ token, action: 'photoUpload', ext: ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg' });
      const { error } = await supabase.storage.from('field-photos').uploadToSignedUrl(path, up, file);
      if (error) throw error;
      const next = [...photos.map(p => p.path), path];
      await run({ action: 'saveReport', report_text: report, photo_paths: next, submit: false }, 'Foto sparat');
    } catch (e) { toast.error((e as Error).message); }
  };

  const uploadReceipt = async (file: File) => {
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
    try {
      const { path, token: up } = await call({ token, action: 'photoUpload', ext: ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg' });
      const { error } = await supabase.storage.from('field-photos').uploadToSignedUrl(path, up, file);
      if (error) throw error;
      setExp(e => (e ? { ...e, receipt_path: path } : e));
      toast.success('Kvitto bifogat');
    } catch (e) { toast.error((e as Error).message); }
  };

  if (inactive) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm text-center space-y-2">
        <Lock className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="text-lg font-bold">Länken är inte längre aktiv</h1>
        <p className="text-sm text-muted-foreground">Kontakta din kontaktperson på uppdragsgivaren om du behöver komma åt ordern igen.</p>
      </div>
    </div>
  );
  if (!d) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Laddar…</div>;

  const o = d.order;
  const address = [o.street, o.postal_code, o.region].filter(Boolean).join(', ') || o.location;
  const total = d.times.reduce((s: number, t: any) => s + Number(t.hours) + Number(t.travel_hours), 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar text-sidebar-foreground px-4 py-4">
        <p className="text-xs opacity-80">FETCH · Underleverantör: {d.me.name}</p>
        <h1 className="text-lg font-bold">{o.name}</h1>
        {o.project_number && <p className="text-xs opacity-80">Order #{o.project_number}</p>}
      </header>
      <main className="mx-auto max-w-lg p-4 space-y-4 pb-16">
        {d.locked && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"><Lock className="inline h-4 w-4 mr-1" />Ordern är klar. Tid kan inte ändras — kontakta admin.</p>}

        <Card title="Uppdraget" icon={CalendarDays}>
          <p className="text-sm"><b>{o.start_date}</b> – <b>{o.end_date}</b>{o.start_time ? ` · ${o.start_time.slice(0, 5)}–${(o.end_time ?? '').slice(0, 5)}` : ''}</p>
          {address && <a className="flex items-start gap-2 text-sm text-primary underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}><MapPin className="h-4 w-4 mt-0.5" />{address}</a>}
          {o.contact_name && <p className="flex items-center gap-2 text-sm"><User className="h-4 w-4" />{o.contact_name}{o.contact_phone && <a href={`tel:${o.contact_phone}`} className="ml-2 flex items-center gap-1 text-primary"><Phone className="h-3.5 w-3.5" />{o.contact_phone}</a>}</p>}
          {o.description && <div><p className="text-xs font-bold text-muted-foreground">Arbetsbeskrivning</p><p className="text-sm whitespace-pre-wrap">{o.description}</p></div>}
        </Card>

        <Card title="Team" icon={Users}>
          {d.team.map((m: any) => (
            <div key={m.id} className="flex items-center gap-2 text-sm">
              <span>{m.name}</span>
              {m.id === d.me.id && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Du</span>}
              {m.subVendor && <span className="text-[10px] font-bold bg-travel-surface text-travel border border-travel/40 px-1.5 py-0.5 rounded-full">UE</span>}
            </div>
          ))}
        </Card>

        <Card title={`Min tid · ${total.toFixed(2)} h`} icon={Clock}>
          {d.times.length === 0 && <p className="text-sm text-muted-foreground">Ingen tid rapporterad än.</p>}
          {d.times.map((t: any) => (
            <div key={t.id} className="flex items-center gap-2 text-sm border-b border-border pb-1">
              <span className="font-semibold">{t.entry_date}</span>
              <span>{t.start_time?.slice(0, 5)}–{t.end_time?.slice(0, 5)}</span>
              <span className="text-muted-foreground">{Number(t.hours)} h + {Number(t.travel_hours)} h resa</span>
              {!d.locked && <span className="ml-auto flex">
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Ändra" onClick={() => setEdit({ id: t.id, entry_date: t.entry_date, start_time: t.start_time?.slice(0, 5), end_time: t.end_time?.slice(0, 5), travel_hours: Number(t.travel_hours), note: t.note ?? '' })}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Ta bort" onClick={() => run({ action: 'deleteTime', id: t.id }, 'Borttagen')}><Trash2 className="h-3.5 w-3.5" /></Button>
              </span>}
            </div>
          ))}
          {!d.locked && !edit && <Button size="sm" onClick={() => setEdit({ entry_date: days(o.start_date, o.end_date).find(x => x === new Date().toLocaleDateString('sv-SE')) ?? o.start_date, start_time: '07:00', end_time: '16:00', travel_hours: 0, note: '' })}>Rapportera tid</Button>}
          {edit && (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="space-y-1"><Label>Dag</Label>
                <Select value={edit.entry_date} onValueChange={v => setEdit({ ...edit, entry_date: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{days(o.start_date, o.end_date).map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Start</Label><TimeWheel label="Start" value={edit.start_time} onChange={v => setEdit({ ...edit, start_time: v })} /></div>
                <div><Label>Slut</Label><TimeWheel label="Slut" value={edit.end_time} onChange={v => setEdit({ ...edit, end_time: v })} fallback="16:00" /></div>
              </div>
              <DurationWheel label="Restid totalt (tur och retur)" value={edit.travel_hours} onChange={v => setEdit({ ...edit, travel_hours: v })} />
              <div><Label>Anteckning (gäller dagens arbete och resa)</Label><Textarea rows={2} value={edit.note} onChange={e => setEdit({ ...edit, note: e.target.value })} /></div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy} onClick={async () => { if (await run({ action: 'saveTime', ...edit, note: edit.note || undefined }, 'Tid sparad')) setEdit(null); }}>Spara</Button>
                <Button size="sm" variant="outline" onClick={() => setEdit(null)}>Avbryt</Button>
              </div>
            </div>
          )}
        </Card>

        <Card title={`Milersättning · ${d.mileage.reduce((s: number, m: any) => s + Number(m.km), 0)} km`} icon={Car}>
          {d.mileage.map((m: any) => (
            <div key={m.id} className="flex items-center gap-2 text-sm border-b border-border pb-1">
              <span className="font-semibold">{m.entry_date}</span><span>{Number(m.km)} km</span>
              {m.note && <span className="truncate text-muted-foreground">{m.note}</span>}
              {!d.locked && <span className="ml-auto flex">
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Ändra" onClick={() => setMile({ id: m.id, entry_date: m.entry_date, km: String(m.km), note: m.note ?? '' })}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Ta bort" onClick={() => run({ action: 'deleteEntry', kind: 'mileage', id: m.id }, 'Borttagen')}><Trash2 className="h-3.5 w-3.5" /></Button>
              </span>}
            </div>
          ))}
          {!d.locked && !mile && <Button size="sm" variant="outline" onClick={() => setMile({ entry_date: o.start_date, km: '', note: '' })}>Lägg till körning</Button>}
          {mile && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <Select value={mile.entry_date} onValueChange={v => setMile({ ...mile, entry_date: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{days(o.start_date, o.end_date).map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" inputMode="decimal" min="0" placeholder="Kilometer (egen bil)" value={mile.km} onChange={e => setMile({ ...mile, km: e.target.value })} />
              <Input placeholder="Anteckning (t.ex. sträcka)" value={mile.note} onChange={e => setMile({ ...mile, note: e.target.value })} />
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !(Number(mile.km) > 0)} onClick={async () => { if (await run({ action: 'saveMileage', id: mile.id, entry_date: mile.entry_date, km: Number(mile.km), note: mile.note || undefined }, 'Körning sparad')) setMile(null); }}>Spara</Button>
                <Button size="sm" variant="outline" onClick={() => setMile(null)}>Avbryt</Button>
              </div>
            </div>
          )}
        </Card>

        <Card title={`Inköp & utlägg · ${d.expenses.reduce((s: number, e: any) => s + Number(e.amount), 0).toFixed(2)} kr`} icon={Receipt}>
          {d.expenses.map((e: any) => (
            <div key={e.id} className="flex items-center gap-2 text-sm border-b border-border pb-1">
              <span className="font-semibold">{e.entry_date}</span><span>{EXP_LABEL[e.category] ?? e.category}</span><span>{Number(e.amount).toFixed(2)} kr</span>
              {e.hasReceipt && <Receipt className="h-3.5 w-3.5 text-primary" aria-label="Kvitto bifogat" />}
              {!d.locked && <span className="ml-auto flex">
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Ta bort" onClick={() => run({ action: 'deleteEntry', kind: 'expense', id: e.id }, 'Borttagen')}><Trash2 className="h-3.5 w-3.5" /></Button>
              </span>}
            </div>
          ))}
          {!d.locked && !exp && <Button size="sm" variant="outline" onClick={() => setExp({ entry_date: o.start_date, category: 'materials', amount: '', note: '' })}>Lägg till inköp</Button>}
          {exp && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                <Select value={exp.entry_date} onValueChange={v => setExp({ ...exp, entry_date: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{days(o.start_date, o.end_date).map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={exp.category} onValueChange={v => setExp({ ...exp, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(EXP_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input type="number" inputMode="decimal" min="0" placeholder="Belopp (kr inkl. moms)" value={exp.amount} onChange={e => setExp({ ...exp, amount: e.target.value })} />
              <Input placeholder="Vad köptes?" value={exp.note} onChange={e => setExp({ ...exp, note: e.target.value })} />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
                <Camera className="h-4 w-4" />{exp.receipt_path ? 'Kvitto bifogat ✓' : 'Fota kvitto'}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={ev => { const f = ev.target.files?.[0]; if (f) uploadReceipt(f); ev.target.value = ''; }} />
              </label>
              <p className="text-xs text-muted-foreground">Kvitto krävs för inköp.</p>
              <div className="flex gap-2">
                <Button size="sm" disabled={busy || !(Number(exp.amount) > 0)} onClick={async () => { if (await run({ action: 'saveExpense', id: exp.id, entry_date: exp.entry_date, category: exp.category, amount: Number(exp.amount), note: exp.note || undefined, receipt_path: exp.receipt_path }, 'Inköp sparat')) setExp(null); }}>Spara</Button>
                <Button size="sm" variant="outline" onClick={() => setExp(null)}>Avbryt</Button>
              </div>
            </div>
          )}
        </Card>

        <Card title="Installationsrapport" icon={Camera}>
          <Textarea rows={4} placeholder="Vad har gjorts?" value={report} onChange={e => setReport(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {photos.map(p => p.url ? <img key={p.path} src={p.url} alt="Foto" className="h-20 w-20 rounded-md object-cover" /> : <div key={p.path} className="h-20 w-20 rounded-md bg-muted" />)}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
            <Camera className="h-4 w-4" />Lägg till foto
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run({ action: 'saveReport', report_text: report, photo_paths: photos.map(p => p.path), submit: false }, 'Utkast sparat')}>Spara</Button>
            <Button size="sm" disabled={busy || !report.trim()} onClick={() => run({ action: 'saveReport', report_text: report, photo_paths: photos.map(p => p.path), submit: true }, 'Rapport skickad')}>Skicka rapport</Button>
          </div>
          {d.report?.submitted_at && <p className="text-xs font-semibold text-primary">Skickad {new Date(d.report.submitted_at).toLocaleString('sv-SE')}</p>}
        </Card>

        <Card title="Rapportera avvikelse" icon={TriangleAlert}>
          <div className="grid grid-cols-2 gap-2">
            <Select value={dev.category} onValueChange={v => setDev({ ...dev, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DEVIATION_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={dev.severity} onValueChange={v => setDev({ ...dev, severity: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DEVIATION_SEVERITIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Textarea rows={3} placeholder="Beskriv (minst 10 tecken)" value={dev.description} onChange={e => setDev({ ...dev, description: e.target.value })} />
          <Button size="sm" variant="destructive" disabled={busy || dev.description.trim().length < 10} onClick={async () => { if (await run({ action: 'deviation', ...dev }, 'Avvikelse skickad')) setDev({ ...dev, description: '' }); }}>Skicka avvikelse</Button>
        </Card>
      </main>
    </div>
  );
};

export default SubVendorOrder;
