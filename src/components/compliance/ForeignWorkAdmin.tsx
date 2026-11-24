import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Plus, Ban, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { ForeignStatusBadge } from './StatusBadge';
import {
  COUNTRY_NAMES, countryName, countDays, summarizeInstaller, docStatus, DOC_STATUS_LABEL, METRIC_LABEL, WINDOW_LABEL, VERIFICATION_LABEL, STATUS_LABEL,
  reportWindow, type ForeignDay, type ForeignRule, type FlagStatus, type Metric, type WindowType, type DocStatus, type Verification,
} from '@/lib/foreignWork';
import { loadForeignDays, loadRules, loadDocs, loadPeriods, loadInstallerLite, todayISO, factWindowForRules, docForCountry, type ForeignDoc, type ForeignPeriod } from '@/lib/foreignWork/data';
import { useProjects, projectRowId } from '@/lib/appData';
import { useAuth } from '@/hooks/useAuth';
import { makeReportRows, groupReportRows, exportReportRows, type ReportRow } from '@/lib/foreignWork/report';

const db = supabase as any;
type PeriodMode = 'year' | 'rolling' | 'range';
type Group = 'person' | 'country' | 'both';
const ALL = 'all';

export default function ForeignWorkAdmin() {
  const asOf = todayISO();
  const { isAdmin, isHr } = useAuth();
  const [installers, setInstallers] = useState<Awaited<ReturnType<typeof loadInstallerLite>>>([]);
  const [days, setDays] = useState<ForeignDay[]>([]);
  const [rules, setRules] = useState<ForeignRule[]>([]);
  const [docs, setDocs] = useState<ForeignDoc[]>([]);
  const [periods, setPeriods] = useState<ForeignPeriod[]>([]);
  const [projects] = useProjects();
  const [mode, setMode] = useState<PeriodMode>('year');
  const [year, setYear] = useState(asOf.slice(0, 4));
  const [range, setRange] = useState({ from: `${asOf.slice(0, 4)}-01-01`, to: asOf });
  const [f, setF] = useState({ installer: ALL, country: ALL, status: ALL, verification: ALL, a1: ALL, project: ALL, type: ALL });
  const [group, setGroup] = useState<Group>('both');
  const [loadError, setLoadError] = useState<string | null>(null);

  const period = reportWindow(mode, year, range, asOf);
  const reload = async () => {
    if (!isAdmin && !isHr) return;
    setLoadError(null);
    try {
      const [ins, r, dc, p] = await Promise.all([loadInstallerLite(), loadRules(isAdmin), loadDocs(), loadPeriods()]);
      const fetchWin = factWindowForRules(r, period, asOf);
      const facts = await loadForeignDays(fetchWin.from, fetchWin.to);
      setInstallers(ins); setRules(r); setDocs(dc); setPeriods(p); setDays(facts);
    } catch (e: any) { setDays([]); setLoadError(e.message); }
  };
  useEffect(() => { void reload(); }, [period.from, period.to, isAdmin, isHr]);

  const projectName = (id: string) => { const p = projects.find(x => projectRowId(x.id) === id); return p ? `${p.id} ${p.name}` : id.slice(0, 8); };

  const rows = useMemo<ReportRow[]>(() => {
    const scoped = f.project === ALL ? days : days.filter(d => (d.project_ids ?? []).includes(f.project));
    const selected = installers.filter(i => (f.installer === ALL || i.id === f.installer) && (f.type === ALL || i.type === f.type));
    const out = makeReportRows(selected, scoped, rules, docs, period, asOf, projectName);
    return out.filter(r => (f.country === ALL || r.country === f.country) && (f.status === ALL || r.status === f.status)
      && (f.verification === ALL || r.verification === f.verification) && (f.a1 === ALL || r.a1 === f.a1));
  }, [days, installers, rules, docs, f, period.from, period.to, projects]);

  const grouped = useMemo(() => groupReportRows(rows, group), [rows, group]);
  const exportXlsx = async () => {
    const { error } = await db.rpc('log_foreign_work_export', { _metadata: { period, filters: f, group, rows: grouped.length, work_days: grouped.reduce((n,r)=>n+r.work,0), inferred_presence: grouped.reduce((n,r)=>n+r.inferredPresence,0) } });
    if (error) { toast.error(error.message); return; }
    const data = exportReportRows(grouped);
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.sheet_add_aoa(ws, [[], ['Totalt', '', '', '', '', '', grouped.reduce((a, r) => a + r.work, 0), grouped.reduce((a,r)=>a+r.verifiedWork,0), grouped.reduce((a,r)=>a+r.derivedWork,0), grouped.every(r=>r.confirmedPresence!=null) ? grouped.reduce((a,r)=>a+(r.confirmedPresence ?? 0),0) : 'EJ VERIFIERAD', grouped.reduce((a,r)=>a+r.inferredPresence,0)]], { origin: -1 });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Utlandsarbete');
    XLSX.writeFile(wb, `utlandsarbete_${period.from}_${period.to}.xlsx`);
  };

  const sel = (k: keyof typeof f, items: [string, string][], label: string) => (
    <div className="space-y-1 min-w-[140px]"><Label className="text-xs">{label}</Label>
      <Select value={f[k]} onValueChange={v => setF(s => ({ ...s, [k]: v }))}><SelectTrigger aria-label={label} className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value={ALL}>Alla</SelectItem>{items.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></div>
  );
  const usedCountries = [...new Set(days.map(d => d.country))].sort();
  const usedProjects = [...new Set(days.flatMap(d => d.project_ids ?? []))];

  if (!isAdmin && !isHr) return null;
  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Utlandsarbete</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">Bevakning av arbete och vistelse utomlands. FETCH räknar fakta och varnar enligt era egna regler – bedömningen av skatt, A1 och arbetsrätt görs alltid av en människa.</p>
      </div>
      <Tabs defaultValue="report">
        {loadError && <p role="alert" className="text-sm text-destructive">Rapporten kunde inte verifieras: {loadError}</p>}
        <TabsList><TabsTrigger value="report">Rapport</TabsTrigger><TabsTrigger value="rules">Regler</TabsTrigger><TabsTrigger value="periods">Vistelseperioder</TabsTrigger><TabsTrigger value="docs">A1 & dokument</TabsTrigger></TabsList>
        <TabsContent value="report" className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label className="text-xs">Period</Label>
              <Select value={mode} onValueChange={v => setMode(v as PeriodMode)}><SelectTrigger aria-label="Period" className="h-8 w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="year">Kalenderår</SelectItem><SelectItem value="rolling">Rullande 12 mån</SelectItem><SelectItem value="range">Datumintervall</SelectItem></SelectContent></Select></div>
            {mode === 'year' && <Input className="h-8 w-24" type="number" value={year} onChange={e => setYear(e.target.value)} />}
            {mode === 'range' && <><Input className="h-8 w-36" type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} /><Input className="h-8 w-36" type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} /></>}
            {sel('installer', installers.map(i => [i.id, i.name]), 'Montör')}
            {sel('type', [['intern', 'Egen personal'], ['UE', 'Underleverantör']], 'Organisation')}
            {sel('country', usedCountries.map(c => [c, countryName(c)]), 'Land')}
            {sel('project', usedProjects.map(p => [p, projectName(p)]), 'Order')}
            {sel('status', (Object.keys(STATUS_LABEL) as FlagStatus[]).map(s => [s, STATUS_LABEL[s]]), 'Status')}
            {sel('verification', (Object.keys(VERIFICATION_LABEL) as Verification[]).map(s => [s, VERIFICATION_LABEL[s]]), 'Verifiering')}
            {sel('a1', (Object.keys(DOC_STATUS_LABEL) as DocStatus[]).map(s => [s, DOC_STATUS_LABEL[s]]), 'A1')}
            <div className="space-y-1"><Label className="text-xs">Gruppera</Label>
              <Select value={group} onValueChange={v => setGroup(v as Group)}><SelectTrigger aria-label="Gruppera" className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="both">Person + land</SelectItem><SelectItem value="person">Person</SelectItem><SelectItem value="country">Land</SelectItem></SelectContent></Select></div>
            <Button size="sm" onClick={exportXlsx} disabled={!grouped.length || !!loadError}><Download className="w-4 h-4 mr-1" />Exportera XLSX</Button>
          </div>
          {installers.some(i => !i.home_country) && <p className="text-xs text-muted-foreground">{installers.filter(i => !i.home_country).length} montörer saknar hemland och har ej verifierade räknare tills det är angivet (Installers & users → redigera).</p>}
          <div className="rounded-lg border overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>{['Montör', 'Hemland', 'Land', 'Arbetsdagar', 'Bekräftad vistelse', 'Härledd vistelse', 'Första', 'Senaste', 'Status', 'Nästa gräns', 'Kvar', 'A1', 'Verifiering'].map(h => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead>
              <tbody>
                {grouped.map((r, i) => <tr key={i} className="border-t"><td className="p-2">{r.installer}</td><td className="p-2">{r.home}</td><td className="p-2">{r.country === '—' ? '—' : countryName(r.country)}</td><td className="p-2">{r.work}</td><td className="p-2">{r.confirmedPresence ?? 'EJ VERIFIERAD'}</td><td className="p-2">{r.inferredPresence}</td><td className="p-2">{r.first}</td><td className="p-2">{r.last}</td><td className="p-2"><ForeignStatusBadge status={r.status} /></td><td className="p-2">{r.nextThreshold}</td><td className="p-2">{r.remaining ?? ''}</td><td className="p-2">{DOC_STATUS_LABEL[r.a1]}</td><td className="p-2">{VERIFICATION_LABEL[r.verification]}</td></tr>)}
                {!grouped.length && <tr><td colSpan={13} className="p-6 text-center text-muted-foreground">Inget utlandsarbete för valda filter.</td></tr>}
                {grouped.length > 0 && <tr className="border-t font-semibold"><td className="p-2" colSpan={3}>Totalt</td><td className="p-2">{grouped.reduce((a, r) => a + r.work, 0)}</td><td className="p-2">{grouped.every(r=>r.confirmedPresence!=null) ? grouped.reduce((a,r)=>a+(r.confirmedPresence ?? 0),0) : 'EJ VERIFIERAD'}</td><td className="p-2">{grouped.reduce((a,r)=>a+r.inferredPresence,0)}</td><td colSpan={7} /></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="rules"><RulesEditor canEdit={isAdmin} rules={rules} onChange={reload} /></TabsContent>
        <TabsContent value="periods"><PeriodsEditor canEdit={isAdmin} periods={periods} installers={installers} onChange={reload} /></TabsContent>
        <TabsContent value="docs"><DocsEditor canEdit={isAdmin} docs={docs} installers={installers} onChange={reload} /></TabsContent>
      </Tabs>
    </div>
  );
}

const countrySelect = (value: string, onChange: (v: string) => void) => (
  <Select value={value} onValueChange={onChange}><SelectTrigger className="h-8"><SelectValue placeholder="Land" /></SelectTrigger>
    <SelectContent>{Object.entries(COUNTRY_NAMES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
);

function RulesEditor({ rules, onChange, canEdit }: { rules: ForeignRule[]; onChange: () => void; canEdit: boolean }) {
  const blank = { name: '', countries: '', metric: 'PRESENCE_DAYS' as Metric, window_type: 'CALENDAR_YEAR' as WindowType, window_start: '', window_end: '', watch_threshold: '', review_threshold: '', critical_threshold: '', effective_from: todayISO(), effective_to: '', explanation: '', internal_note: '' };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const save = async () => {
    if (!canEdit) return;
    const thresholds = [Number(form.watch_threshold), Number(form.review_threshold), Number(form.critical_threshold)];
    if (!thresholds.every(n=>Number.isInteger(n) && n>0) || thresholds[0]>thresholds[1] || thresholds[1]>thresholds[2]) { toast.error('Ange tre positiva gränsvärden i stigande ordning'); return; }
    const payload = { ...form, watch_threshold: thresholds[0], review_threshold: thresholds[1], critical_threshold: thresholds[2], countries: form.countries.split(',').map(s => s.trim().toUpperCase()).filter(Boolean), window_start: form.window_start || null, window_end: form.window_end || null, effective_to: form.effective_to || null };
    const { error } = editId ? await db.from('foreign_work_rules').update(payload).eq('id',editId) : await db.from('foreign_work_rules').insert(payload);
    if (error) toast.error(error.message); else { toast.success('Regel sparad'); setForm(blank); setEditId(null); onChange(); }
  };
  const toggle = async (r: ForeignRule) => { if (!canEdit) return; const { error } = await db.from('foreign_work_rules').update({ enabled: !r.enabled }).eq('id', r.id); if (error) toast.error(error.message); else onChange(); };
  const n = (k: 'watch_threshold' | 'review_threshold' | 'critical_threshold') => <Input className="h-8" type="number" aria-label={k} value={form[k]} onChange={e => setForm(s => ({ ...s, [k]: e.target.value }))} />;
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Gränsvärdena är era egna bevakningsnivåer – inte juridiska slutsatser.</p>
      <div className="rounded-lg border divide-y">
        {rules.map(r => <div key={r.id} className="p-3 flex items-center justify-between gap-3 text-sm">
          <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.countries.length ? r.countries.map(countryName).join(', ') : 'Alla länder'} · {METRIC_LABEL[r.metric]} · {WINDOW_LABEL[r.window_type]} · {r.watch_threshold}/{r.review_threshold}/{r.critical_threshold} · gäller {r.effective_from}{r.effective_to ? `–${r.effective_to}` : ''}</p>{r.explanation && <p className="text-xs">{r.explanation}</p>}</div>
          <div className="flex gap-2 items-center"><Switch disabled={!canEdit} checked={r.enabled} onCheckedChange={() => toggle(r)} />{canEdit && <Button size="icon" variant="ghost" aria-label={`Redigera ${r.name}`} onClick={()=>{setEditId(r.id);setForm({...blank,...r,countries:r.countries.join(', '),window_start:r.window_start ?? '',window_end:r.window_end ?? '',effective_to:r.effective_to ?? '',explanation:r.explanation ?? '',watch_threshold:String(r.watch_threshold),review_threshold:String(r.review_threshold),critical_threshold:String(r.critical_threshold)});}}><Pencil className="w-4 h-4" /></Button>}</div>
        </div>)}
        {!rules.length && <p className="p-4 text-sm text-muted-foreground">Inga regler ännu. Utan regler visas bara räknare, inga varningar.</p>}
      </div>
      {canEdit && <div className="border-t pt-4 grid gap-3 md:grid-cols-3">
        <div className="space-y-1"><Label className="text-xs">Namn</Label><Input className="h-8" value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} /></div>
        <div className="space-y-1"><Label className="text-xs">Länder (koder, tomt = alla)</Label><Input className="h-8" placeholder="NO, FI" value={form.countries} onChange={e => setForm(s => ({ ...s, countries: e.target.value }))} /></div>
        <div className="space-y-1"><Label className="text-xs">Mätvärde</Label><Select value={form.metric} onValueChange={v => setForm(s => ({ ...s, metric: v as Metric }))}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(METRIC_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label className="text-xs">Period</Label><Select value={form.window_type} onValueChange={v => setForm(s => ({ ...s, window_type: v as WindowType }))}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(WINDOW_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
        {(form.window_type === 'FIXED_DATE_RANGE' || form.window_type === 'CONTINUOUS_ASSIGNMENT') && <><div className="space-y-1"><Label className="text-xs">Från</Label><Input className="h-8" type="date" value={form.window_start} onChange={e => setForm(s => ({ ...s, window_start: e.target.value }))} /></div><div className="space-y-1"><Label className="text-xs">Till</Label><Input className="h-8" type="date" value={form.window_end} onChange={e => setForm(s => ({ ...s, window_end: e.target.value }))} /></div></>}
        <div className="space-y-1"><Label className="text-xs">Bevaka från</Label>{n('watch_threshold')}</div>
        <div className="space-y-1"><Label className="text-xs">Kontroll krävs från</Label>{n('review_threshold')}</div>
        <div className="space-y-1"><Label className="text-xs">Gränsvärde</Label>{n('critical_threshold')}</div>
        <div className="space-y-1"><Label className="text-xs">Gäller från</Label><Input className="h-8" type="date" value={form.effective_from} onChange={e => setForm(s => ({ ...s, effective_from: e.target.value }))} /></div>
        <div className="space-y-1"><Label className="text-xs">Gäller till (valfritt)</Label><Input className="h-8" type="date" value={form.effective_to} onChange={e => setForm(s => ({ ...s, effective_to: e.target.value }))} /></div>
        <div className="space-y-1 md:col-span-3"><Label className="text-xs">Förklaring för användare</Label><Textarea value={form.explanation} onChange={e => setForm(s => ({ ...s, explanation: e.target.value }))} /></div>
        <div className="space-y-1 md:col-span-3"><Label className="text-xs">Intern anteckning</Label><Input className="h-8" value={form.internal_note} onChange={e => setForm(s => ({ ...s, internal_note: e.target.value }))} /></div>
        <Button size="sm" className="w-fit" onClick={save} disabled={!form.name}><Plus className="w-4 h-4 mr-1" />{editId ? 'Spara regel' : 'Lägg till regel'}</Button>
      </div>}
    </div>
  );
}

function PeriodsEditor({ periods, installers, onChange, canEdit }: { periods: ForeignPeriod[]; installers: { id: string; name: string }[]; onChange: () => void; canEdit: boolean }) {
  const blank = { installer_id: '', country: '', start_at: '', end_at: '', kind: 'presence', notes: '' };
  const [form, setForm] = useState(blank);
  const save = async () => {
    const { error } = await db.from('foreign_work_periods').insert({ ...form, start_at: new Date(form.start_at).toISOString(), end_at: new Date(form.end_at).toISOString(), source: 'admin_confirmed', verification_status: 'MANUALLY_CONFIRMED' });
    if (error) toast.error(error.message); else { toast.success('Period sparad'); setForm(blank); onChange(); }
  };
  const voidIt = async (p: ForeignPeriod) => {
    const reason = window.prompt('Anledning till makulering?'); if (!reason) return;
    const { error } = await db.from('foreign_work_periods').update({ voided_at: new Date().toISOString(), void_reason: reason, verification_status: 'VOIDED' }).eq('id', p.id);
    if (error) toast.error(error.message); else onChange();
  };
  const name = (id: string) => installers.find(i => i.id === id)?.name ?? '—';
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Bekräftade resor och vistelser (t.ex. avresa söndag kväll). Tidsposter ger arbetsdagar automatiskt; vistelse före/efter jobbet måste anges här. Poster raderas aldrig, de makuleras.</p>
      {canEdit && <div className="border-t pt-4 grid gap-3 md:grid-cols-3">
        <div className="space-y-1"><Label className="text-xs">Montör</Label><Select value={form.installer_id} onValueChange={v => setForm(s => ({ ...s, installer_id: v }))}><SelectTrigger className="h-8"><SelectValue placeholder="Välj" /></SelectTrigger><SelectContent>{installers.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label className="text-xs">Land</Label>{countrySelect(form.country, v => setForm(s => ({ ...s, country: v })))}</div>
        <div className="space-y-1"><Label className="text-xs">Typ</Label><Select value={form.kind} onValueChange={v => setForm(s => ({ ...s, kind: v }))}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="presence">Vistelse</SelectItem><SelectItem value="work">Bekräftat arbete</SelectItem></SelectContent></Select></div>
        <div className="space-y-1"><Label className="text-xs">Från (datum/tid)</Label><Input className="h-8" type="datetime-local" value={form.start_at} onChange={e => setForm(s => ({ ...s, start_at: e.target.value }))} /></div>
        <div className="space-y-1"><Label className="text-xs">Till (datum/tid)</Label><Input className="h-8" type="datetime-local" value={form.end_at} onChange={e => setForm(s => ({ ...s, end_at: e.target.value }))} /></div>
        <div className="space-y-1"><Label className="text-xs">Anteckning</Label><Input className="h-8" value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))} /></div>
        <Button size="sm" className="w-fit" onClick={save} disabled={!form.installer_id || !form.country || !form.start_at || !form.end_at}><Plus className="w-4 h-4 mr-1" />Lägg till period</Button>
      </div>}
      <div className="rounded-lg border divide-y text-sm">
        {periods.map(p => <div key={p.id} className={`p-3 flex justify-between ${p.voided_at ? 'text-muted-foreground line-through' : ''}`}>
          <span>{name(p.installer_id)} · {countryName(p.country)} · {p.start_at.slice(0, 16).replace('T', ' ')} – {p.end_at.slice(0, 16).replace('T', ' ')} · {p.kind === 'work' ? 'arbete' : 'vistelse'}{p.notes ? ` · ${p.notes}` : ''}</span>
          {canEdit && !p.voided_at && <Button variant="ghost" size="sm" onClick={() => voidIt(p)}><Ban className="w-4 h-4 mr-1" />Makulera</Button>}
        </div>)}
        {!periods.length && <p className="p-4 text-muted-foreground">Inga perioder registrerade.</p>}
      </div>
    </div>
  );
}

function DocsEditor({ docs, installers, onChange, canEdit }: { docs: ForeignDoc[]; installers: { id: string; name: string }[]; onChange: () => void; canEdit: boolean }) {
  const blank = { installer_id: '', doc_type: 'A1', country: '', valid_from: '', valid_to: '', status: 'VALID', reference_number: '', notes: '' };
  const [form, setForm] = useState(blank);
  const save = async () => {
    const { country, ...rest } = form;
    const { error } = await db.from('foreign_work_documents').insert({ ...rest, countries: country ? [country] : [], valid_from: form.valid_from || null, valid_to: form.valid_to || null });
    if (error) toast.error(error.message); else { toast.success('Dokument sparat'); setForm(blank); onChange(); }
  };
  const voidIt = async (d: ForeignDoc) => { const { error } = await db.from('foreign_work_documents').update({ voided_at: new Date().toISOString() }).eq('id', d.id); if (error) toast.error(error.message); else onChange(); };
  const name = (id: string) => installers.find(i => i.id === id)?.name ?? '—';
  const types: Record<string, string> = { A1: 'A1-intyg', POSTING_NOTIFICATION: 'Utstationeringsanmälan', WORK_PERMIT: 'Arbetstillstånd', OTHER_COMPLIANCE_DOCUMENT: 'Annat' };
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Endast uppgifter om dokumentet. Själva filen lagras i Dokumenthanteringen med dess behörigheter.</p>
      {canEdit && <div className="border-t pt-4 grid gap-3 md:grid-cols-4">
        <div className="space-y-1"><Label className="text-xs">Montör</Label><Select value={form.installer_id} onValueChange={v => setForm(s => ({ ...s, installer_id: v }))}><SelectTrigger className="h-8"><SelectValue placeholder="Välj" /></SelectTrigger><SelectContent>{installers.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label className="text-xs">Typ</Label><Select value={form.doc_type} onValueChange={v => setForm(s => ({ ...s, doc_type: v }))}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(types).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label className="text-xs">Land (tomt = alla)</Label>{countrySelect(form.country, v => setForm(s => ({ ...s, country: v })))}</div>
        <div className="space-y-1"><Label className="text-xs">Status</Label><Select value={form.status} onValueChange={v => setForm(s => ({ ...s, status: v }))}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(DOC_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label className="text-xs">Giltig från</Label><Input className="h-8" type="date" value={form.valid_from} onChange={e => setForm(s => ({ ...s, valid_from: e.target.value }))} /></div>
        <div className="space-y-1"><Label className="text-xs">Giltig till</Label><Input className="h-8" type="date" value={form.valid_to} onChange={e => setForm(s => ({ ...s, valid_to: e.target.value }))} /></div>
        <div className="space-y-1"><Label className="text-xs">Referensnummer</Label><Input className="h-8" value={form.reference_number} onChange={e => setForm(s => ({ ...s, reference_number: e.target.value }))} /></div>
        <div className="space-y-1"><Label className="text-xs">Anteckning</Label><Input className="h-8" value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))} /></div>
        <Button size="sm" className="w-fit" onClick={save} disabled={!form.installer_id}><Plus className="w-4 h-4 mr-1" />Lägg till</Button>
      </div>}
      <div className="rounded-lg border divide-y text-sm">
        {docs.map(d => <div key={d.id} className="p-3 flex justify-between"><span>{name(d.installer_id)} · {types[d.doc_type]} · {d.countries.length ? d.countries.map(countryName).join(', ') : 'Alla länder'} · {d.valid_from ?? '?'}–{d.valid_to ?? '?'} · {DOC_STATUS_LABEL[docStatus(d, todayISO())]}{d.reference_number ? ` · ${d.reference_number}` : ''}</span>{canEdit && <Button variant="ghost" size="sm" onClick={() => voidIt(d)}><Ban className="w-4 h-4 mr-1" />Makulera</Button>}</div>)}
        {!docs.length && <p className="p-4 text-muted-foreground">Inga dokument registrerade.</p>}
      </div>
    </div>
  );
}
