import { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
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
import { toast } from 'sonner';
import {
  DEFAULT_EXCLUDES, EXCLUDE_OPTIONS, exportFieldReportPdf, exportFieldReportXlsx, loadFieldReportData,
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

  const create = async () => {
    const ids = chosen.map(p => projectRowId(p.id)).filter(Boolean) as string[];
    if (!ids.length) return;
    setBusy(true);
    try {
      const data = await loadFieldReportData(ids);
      if (format === 'pdf') await exportFieldReportPdf(data, { exclude, kind });
      else exportFieldReportXlsx(data, { exclude, kind });
      setOpen(false);
    } catch (e) {
      toast.error('Rapporten kunde inte skapas', { description: e instanceof Error ? e.message : undefined });
    } finally { setBusy(false); }
  };

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
        <DialogContent>
          <DialogHeader><DialogTitle>Create report – {chosen.length} work orders</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="font-semibold">Report for</Label>
              <RadioGroup value={kind} onValueChange={v => { const k = v as ReportKind; setKind(k); setExclude(DEFAULT_EXCLUDES[k]); }} className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="client" />Client</label>
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="internal" />Internal</label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">What to leave out?</Label>
              {EXCLUDE_OPTIONS.map(o => (
                <label key={o.key} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox checked={exclude.includes(o.key)} onCheckedChange={c => setExclude(prev => c ? [...prev, o.key] : prev.filter(k => k !== o.key))} />
                  {o.label}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">Format</Label>
              <RadioGroup value={format} onValueChange={v => setFormat(v as 'pdf' | 'xlsx')} className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="pdf" /><FileDown className="w-4 h-4" />PDF</label>
                <label className="flex items-center gap-2 cursor-pointer"><RadioGroupItem value="xlsx" /><FileSpreadsheet className="w-4 h-4" />Excel</label>
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Download report'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
