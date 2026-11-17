import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Eye, FileDown, FileSpreadsheet, FileText, Square } from 'lucide-react';
import { type Project, type ProjectStatus, statusLabels } from '@/data/mockData';
import { projectRowId } from '@/lib/appData';
import { overlapsRange } from '@/lib/ganttDates';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  DEFAULT_EXCLUDES, EXCLUDE_OPTIONS, exportFieldReportPdf, exportFieldReportXlsx, flatReportRows, loadFieldReportData, previewFieldReportPdf,
  type FieldReportData,
  type ExcludeKey, type ReportKind,
} from '@/lib/fieldReportExport';

type Period = 'this-week' | 'last-week' | 'this-month' | 'last-month' | 'custom' | 'all';
const iso = (d: Date) => d.toLocaleDateString('sv-SE');

function periodRange(p: Period, from: string, to: string): [Date, Date] | null {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const monday = new Date(t); monday.setDate(t.getDate() - ((t.getDay() + 6) % 7));
  const add = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  switch (p) {
    case 'this-week': return [monday, add(monday, 6)];
    case 'last-week': return [add(monday, -7), add(monday, -1)];
    case 'this-month': return [new Date(t.getFullYear(), t.getMonth(), 1), new Date(t.getFullYear(), t.getMonth() + 1, 0)];
    case 'last-month': return [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)];
    case 'custom': return from && to ? [new Date(`${from}T00:00:00`), new Date(`${to}T00:00:00`)] : null;
    default: return null;
  }
}

export default function WorkOrderReports({ projects }: { projects: Project[] }) {
  const [period, setPeriod] = useState<Period>('this-week');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [client, setClient] = useState('all');
  const [status, setStatus] = useState<'all' | ProjectStatus>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ReportKind>('client');
  const [exclude, setExclude] = useState<ExcludeKey[]>(DEFAULT_EXCLUDES.client);
  const [format, setFormat] = useState<'pdf' | 'xlsx'>('pdf');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'settings' | 'preview'>('settings');
  const [data, setData] = useState<FieldReportData[] | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  const clients = useMemo(() => [...new Set(projects.map(p => p.client).filter(Boolean))].sort(), [projects]);
  const rows = useMemo(() => {
    const r = periodRange(period, from, to);
    const s = q.trim().toLowerCase();
    return projects
      .filter(p => p.status !== 'cancelled' || status === 'cancelled')
      .filter(p => !r || overlapsRange(p.startDate, p.endDate, r[0], r[1]))
      .filter(p => client === 'all' || p.client === client)
      .filter(p => status === 'all' || p.status === status)
      .filter(p => !s || `${p.name} ${p.client} ${p.projectNumber ?? ''} ${p.location ?? ''}`.toLowerCase().includes(s))
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [projects, period, from, to, q, client, status]);

  const allSelected = rows.length > 0 && rows.every(r => selected.has(r.id));
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(prev => { const n = new Set(prev); rows.forEach(r => (allSelected ? n.delete(r.id) : n.add(r.id))); return n; });
  const chosen = projects.filter(p => selected.has(p.id));

  const chosenIds = useMemo(() => [...chosen].sort((a, b) => a.startDate.localeCompare(b.startDate)).map(p => projectRowId(p.id)).filter(Boolean) as string[], [chosen]);
  const getData = async () => data ?? (await loadFieldReportData(chosenIds).then(d => { setData(d); return d; }));
  useEffect(() => { if (!open) { setData(null); setTab('settings'); } }, [open]);
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);
  useEffect(() => {
    if (!open || tab !== 'preview' || format !== 'pdf') return;
    let alive = true;
    setPreviewBusy(true);
    getData().then(d => previewFieldReportPdf(d, { exclude, kind })).then(u => { if (alive) setPdfUrl(u); else URL.revokeObjectURL(u); })
      .catch(e => toast.error('Förhandsgranskningen misslyckades', { description: e instanceof Error ? e.message : undefined }))
      .finally(() => alive && setPreviewBusy(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, format, kind, exclude.join(',')]);
  useEffect(() => { if (open && tab === 'preview' && format === 'xlsx' && !data) getData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, tab, format]);
  const flat = useMemo(() => (data && format === 'xlsx' ? flatReportRows(data, exclude) : []), [data, format, exclude]);

  const create = async () => {
    if (!chosenIds.length) return;
    setBusy(true);
    try {
      const d = await getData();
      if (format === 'pdf') await exportFieldReportPdf(d, { exclude, kind });
      else exportFieldReportXlsx(d, { exclude, kind });
      setOpen(false);
    } catch (e) {
      toast.error('Rapporten kunde inte skapas', { description: e instanceof Error ? e.message : undefined });
    } finally { setBusy(false); }
  };
  const selectAll = () => setSelected(prev => { const n = new Set(prev); rows.forEach(r => n.add(r.id)); return n; });

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Work order reports</h1>
          <p className="text-sm text-muted-foreground">Mark work orders and create one combined report for the client or for internal use.</p>
        </div>
        <Button disabled={!selected.size} onClick={() => setOpen(true)}><FileText className="w-4 h-4" />Create report ({selected.size})</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1"><Label>Period</Label>
          <Select value={period} onValueChange={v => setPeriod(v as Period)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this-week">This week</SelectItem>
              <SelectItem value="last-week">Last week</SelectItem>
              <SelectItem value="this-month">This month</SelectItem>
              <SelectItem value="last-month">Last month</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
              <SelectItem value="all">All dates</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period === 'custom' && <>
          <div className="space-y-1"><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </>}
        <div className="space-y-1"><Label>Customer</Label>
          <Select value={client} onValueChange={setClient}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>Status</Label>
          <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(statusLabels) as ProjectStatus[]).map(s => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-48"><Label>Search</Label><Input placeholder="e.g. Scandic" value={q} onChange={e => setQ(e.target.value)} /></div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={selectAll} disabled={!rows.length || allSelected}><CheckSquare className="w-4 h-4" />Markera alla ({rows.length})</Button>
        <Button variant="outline" size="sm" onClick={() => setSelected(new Set())} disabled={!selected.size}><Square className="w-4 h-4" />Avmarkera alla</Button>
        <span className="text-sm text-muted-foreground ml-1">{selected.size} valda</span>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><Checkbox aria-label="Select all" checked={allSelected} onCheckedChange={toggleAll} /></TableHead>
              <TableHead>Work order</TableHead><TableHead>Order #</TableHead><TableHead>Customer</TableHead><TableHead>Period</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No work orders match the filters.</TableCell></TableRow>}
            {rows.map(p => (
              <TableRow key={p.id} className="cursor-pointer" data-state={selected.has(p.id) ? 'selected' : undefined} onClick={() => toggle(p.id)}>
                <TableCell onClick={e => e.stopPropagation()}><Checkbox aria-label={`Select ${p.name}`} checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} /></TableCell>
                <TableCell className="font-semibold">{p.name}</TableCell>
                <TableCell>{p.projectNumber ?? '–'}</TableCell>
                <TableCell>{p.client}</TableCell>
                <TableCell className="whitespace-nowrap">{p.startDate} – {p.endDate}</TableCell>
                <TableCell>{statusLabels[p.status]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {selected.size > rows.filter(r => selected.has(r.id)).length && (
        <p className="text-xs text-muted-foreground">{selected.size} selected in total, including some outside the current filter. <button className="text-primary hover:underline" onClick={() => setSelected(new Set())}>Clear selection</button></p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={`w-[calc(100vw-1rem)] min-w-0 ${tab === 'preview' ? 'max-w-5xl' : 'max-w-lg'}`}>
          <DialogHeader><DialogTitle>Skapa rapport – {chosen.length} arbetsordrar</DialogTitle></DialogHeader>
          <Tabs className="min-w-0" value={tab} onValueChange={v => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="settings">Inställningar</TabsTrigger>
              <TabsTrigger value="preview"><Eye className="w-4 h-4 mr-1" />Förhandsgranska</TabsTrigger>
            </TabsList>
            <TabsContent value="settings" className="space-y-5 pt-2">
              <div className="space-y-2">
                <Label className="font-semibold">Rapport för</Label>
                <RadioGroup value={kind} onValueChange={v => { const k = v as ReportKind; setKind(k); setExclude(DEFAULT_EXCLUDES[k]); }} className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="client" />Kund</label>
                  <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="internal" />Intern</label>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Vad ska lämnas bort?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {EXCLUDE_OPTIONS.map(o => (
                    <label key={o.key} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox checked={exclude.includes(o.key)} onCheckedChange={c => setExclude(prev => c ? [...prev, o.key] : prev.filter(k => k !== o.key))} />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold">Format</Label>
                <RadioGroup value={format} onValueChange={v => setFormat(v as 'pdf' | 'xlsx')} className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="pdf" /><FileDown className="w-4 h-4" />PDF</label>
                  <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="xlsx" /><FileSpreadsheet className="w-4 h-4" />Excel (en rad per post)</label>
                </RadioGroup>
              </div>
            </TabsContent>
            <TabsContent value="preview" className="pt-2 min-w-0">
              {format === 'pdf' ? (
                previewBusy || !pdfUrl
                  ? <div className="h-[65vh] grid place-items-center text-sm text-muted-foreground">Skapar förhandsgranskning…</div>
                  : <iframe title="Förhandsgranskning" src={pdfUrl} className="w-full h-[65vh] rounded-md border border-border" />
              ) : (
                <div className="h-[65vh] overflow-auto rounded-md border border-border">
                  {!data ? <div className="p-8 text-center text-sm text-muted-foreground">Laddar…</div> : (
                    <Table>
                      <TableHeader><TableRow>{['Ordernr', 'Order', 'Kund', 'Datum', 'Montör', 'Kostnadsslag', 'Beskrivning', 'Antal', 'Enhet', 'Á-pris', 'Belopp (kr)', 'Kvitton'].map(h => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader>
                      <TableBody>
                        {flat.length === 0 && <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">Inga rader</TableCell></TableRow>}
                        {flat.map((r, i) => <TableRow key={i}>{Object.values(r).map((v, k) => <TableCell key={k} className="whitespace-nowrap py-1.5 text-xs">{String(v)}</TableCell>)}</TableRow>)}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Avbryt</Button>
            {tab === 'settings' && <Button variant="outline" onClick={() => setTab('preview')}><Eye className="w-4 h-4" />Förhandsgranska</Button>}
            <Button onClick={create} disabled={busy}>{busy ? 'Skapar…' : 'Ladda ner rapport'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
