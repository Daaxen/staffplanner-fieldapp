import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTimeReportingRefs, useTimeRows } from '@/hooks/useTimeReporting';
import {
  INTERNAL_CUSTOMER_NUMBER, buildWorkbook, clientLabel, exportFileName, isoDate, rowHours, sumBy, type ExportLine,
} from '@/lib/timeReporting';

const ALL = '__all';
const fmt = (h: number) => h.toFixed(2).replace('.', ',');

export default function TimeOverview({ exportMode = false }: { exportMode?: boolean }) {
  const refs = useTimeReportingRefs();
  const today = new Date();
  const [from, setFrom] = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(isoDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
  const [f, setF] = useState({ employee: ALL, client: ALL, group: ALL, order: ALL, activity: ALL });
  const { rows, loading } = useTimeRows({ from, to });

  const by = <T extends { id: string }>(l: T[], id?: string | null) => l.find(x => x.id === id);
  const filtered = useMemo(() => rows.filter(r =>
    (f.employee === ALL || r.installer_id === f.employee) && (f.client === ALL || r.client_id === f.client) &&
    (f.group === ALL || r.project_group_id === f.group) && (f.order === ALL || r.project_id === f.order) &&
    (f.activity === ALL || r.activity_type_id === f.activity)), [rows, f]);

  const total = filtered.reduce((s, r) => s + rowHours(r), 0);
  const internalId = refs.clients.find(c => c.customer_number === INTERNAL_CUSTOMER_NUMBER)?.id;
  const internalTotal = filtered.filter(r => r.client_id === internalId).reduce((s, r) => s + rowHours(r), 0);
  const summaries = [
    { title: 'Per kund', data: sumBy(filtered, r => clientLabel(by(refs.clients, r.client_id)) || '–', rowHours) },
    { title: 'Per projekt', data: sumBy(filtered, r => by(refs.groups, r.project_group_id)?.name ?? 'Inget projekt', rowHours) },
    { title: 'Per medarbetare', data: sumBy(filtered, r => by(refs.employees, r.installer_id)?.name ?? '–', rowHours) },
    { title: 'Per aktivitet', data: sumBy(filtered, r => by(refs.activities, r.activity_type_id)?.name ?? '–', rowHours) },
  ];

  const doExport = () => {
    const lines: ExportLine[] = filtered.map(r => {
      const c = by(refs.clients, r.client_id), g = by(refs.groups, r.project_group_id), o = by(refs.orders, r.project_id);
      return {
        Datum: r.entry_date, Medarbetare: by(refs.employees, r.installer_id)?.name ?? '', Kundnummer: c?.customer_number ?? '',
        Kundnamn: c?.name ?? '', Projektnummer: g?.project_number ?? '', Projektnamn: g?.name ?? '', Ordernummer: o?.project_number ?? '',
        Aktivitetstyp: by(refs.activities, r.activity_type_id)?.name ?? '', 'Antal timmar': Math.round(rowHours(r) * 100) / 100,
        Beskrivning: r.description ?? r.note ?? '', Skapad: new Date(r.created_at).toLocaleString('sv-SE'),
        'Senast ändrad': new Date(r.updated_at).toLocaleString('sv-SE'),
      };
    });
    XLSX.writeFile(buildWorkbook(lines), exportFileName(from, to));
  };

  const sel = (key: keyof typeof f, label: string, opts: { id: string; label: string }[]) => (
    <div className="min-w-40 flex-1">
      <Label className="text-xs">{label}</Label>
      <Select value={f[key]} onValueChange={v => setF({ ...f, [key]: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value={ALL}>Alla</SelectItem>{opts.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{exportMode ? 'Export av tidsrapport' : 'Tidsöversikt'}</h1>
        <Button onClick={doExport} disabled={filtered.length === 0}><Download className="w-4 h-4 mr-1" />Exportera XLSX</Button>
      </div>
      <div className="flex flex-wrap gap-3 items-end">
        <div><Label className="text-xs">Från</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">Till</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        {sel('employee', 'Medarbetare', refs.employees.map(e => ({ id: e.id, label: e.name })))}
        {sel('client', 'Kund', refs.clients.map(c => ({ id: c.id, label: clientLabel(c) })))}
        {sel('group', 'Projekt', refs.groups.filter(g => f.client === ALL || g.client_id === f.client).map(g => ({ id: g.id, label: g.name })))}
        {sel('order', 'Order', refs.orders.filter(o => f.client === ALL || o.client_id === f.client).map(o => ({ id: o.id, label: `${o.project_number ?? ''} ${o.name}`.trim() })))}
        {sel('activity', 'Aktivitet', refs.activities.map(a => ({ id: a.id, label: a.name })))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-md border border-border p-3"><div className="text-xs text-muted-foreground">Total rapporterad tid</div><div className="text-2xl font-semibold">{fmt(total)} h</div></div>
        <div className="rounded-md border border-border p-3"><div className="text-xs text-muted-foreground">Mot kund 9999</div><div className="text-2xl font-semibold">{fmt(internalTotal)} h</div></div>
        <div className="rounded-md border border-border p-3"><div className="text-xs text-muted-foreground">Tidsrader</div><div className="text-2xl font-semibold">{filtered.length}</div></div>
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        {summaries.map(s => (
          <div key={s.title} className="rounded-md border border-border p-3">
            <div className="text-sm font-medium mb-2">{s.title}</div>
            <div className="space-y-1 max-h-40 overflow-auto text-sm">
              {s.data.map(d => <div key={d.key} className="flex justify-between gap-2"><span className="truncate">{d.key}</span><span>{fmt(d.hours)}</span></div>)}
            </div>
          </div>
        ))}
      </div>
      {!exportMode && (
        <div className="rounded-md border border-border">
          <Table>
            <TableHeader><TableRow>
              {['Datum', 'Medarbetare', 'Kundnr', 'Kund', 'Projekt', 'Order', 'Aktivitet', 'Timmar', 'Beskrivning', 'Senast ändrad'].map(h => <TableHead key={h}>{h}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={10}>Laddar…</TableCell></TableRow> : filtered.map(r => {
                const c = by(refs.clients, r.client_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.entry_date}</TableCell>
                    <TableCell>{by(refs.employees, r.installer_id)?.name}</TableCell>
                    <TableCell>{c?.customer_number}</TableCell>
                    <TableCell>{c?.name}</TableCell>
                    <TableCell>{by(refs.groups, r.project_group_id)?.name}</TableCell>
                    <TableCell>{by(refs.orders, r.project_id)?.name}</TableCell>
                    <TableCell>{by(refs.activities, r.activity_type_id)?.name}</TableCell>
                    <TableCell className="text-right">{fmt(rowHours(r))}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.description ?? r.note}</TableCell>
                    <TableCell>{new Date(r.updated_at).toLocaleString('sv-SE')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
