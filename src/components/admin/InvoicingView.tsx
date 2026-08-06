import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Download, AlertTriangle, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { projects as mockProjects, clientRegister, ratesForClient, DEFAULT_CLIENT_RATES } from '@/data/mockData';
import { expenseCategoryLabels, type ExpenseCategory } from '@/data/logsData';
import { toast } from 'sonner';

type Line = {
  id: string;
  type: 'time' | 'expense' | 'mileage';
  date: string;
  projectId: string;
  projectName: string;
  clientName: string;
  installerId: string;
  installerName: string;
  hours: number;
  km: number;
  rate: number;
  amount: number;   // ex VAT
  detail: string;
};

const sek = (n: number) => `${Math.round(n).toLocaleString('sv-SE')} SEK`;

const InvoicingView = () => {
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [client, setClient] = useState('all');
  const [installer, setInstaller] = useState('all');
  const [type, setType] = useState('all');

  const load = async () => {
    setLoading(true);
    const [t, e, m, profs] = await Promise.all([
      supabase.from('time_entries').select('*'),
      supabase.from('expense_entries').select('*'),
      supabase.from('mileage_entries').select('*'),
      supabase.from('profiles').select('id, full_name, email'),
    ]);
    const nameOf = (id: string) => {
      const p = (profs.data ?? []).find(x => x.id === id);
      return p?.full_name || p?.email || id.slice(0, 8);
    };
    const projMeta = (projectId: string, fallbackProject?: string | null, fallbackClient?: string | null) => {
      const p = mockProjects.find(x => x.id === projectId);
      return {
        projectName: p?.name ?? fallbackProject ?? projectId,
        clientName: p?.client ?? fallbackClient ?? '—',
        clientId: p?.clientId,
      };
    };

    const rows: Line[] = [];
    (t.data ?? []).forEach(r => {
      const meta = projMeta(r.project_id, r.project_name, r.client_name);
      const rate = Number(r.hourly_rate ?? ratesForClient(meta.clientName, meta.clientId).hourlyRate);
      rows.push({
        id: r.id, type: 'time', date: r.entry_date, projectId: r.project_id, ...meta,
        installerId: r.installer_id, installerName: nameOf(r.installer_id),
        hours: Number(r.hours), km: 0, rate, amount: Number(r.hours) * rate,
        detail: [r.start_time && r.end_time ? `${r.start_time}–${r.end_time}` : r.source, r.note].filter(Boolean).join(' · '),
      });
    });
    (e.data ?? []).forEach(r => {
      const meta = projMeta(r.project_id, r.project_name, r.client_name);
      rows.push({
        id: r.id, type: 'expense', date: r.entry_date, projectId: r.project_id, ...meta,
        installerId: r.installer_id, installerName: nameOf(r.installer_id),
        hours: 0, km: 0, rate: 0, amount: Number(r.amount),
        detail: [expenseCategoryLabels[r.category as ExpenseCategory] ?? r.category, r.note, r.receipt_path].filter(Boolean).join(' · '),
      });
    });
    (m.data ?? []).forEach(r => {
      const meta = projMeta(r.project_id, r.project_name, r.client_name);
      rows.push({
        id: r.id, type: 'mileage', date: r.entry_date, projectId: r.project_id, ...meta,
        installerId: r.installer_id, installerName: nameOf(r.installer_id),
        hours: 0, km: Number(r.km), rate: Number(r.rate), amount: Number(r.amount),
        detail: [`${r.km} km × ${r.rate} SEK`, r.note].filter(Boolean).join(' · '),
      });
    });
    setLines(rows.sort((a, b) => (a.date < b.date ? 1 : -1)));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => lines.filter(l =>
    (!from || l.date >= from) &&
    (!to || l.date <= to) &&
    (client === 'all' || l.clientName === client) &&
    (installer === 'all' || l.installerId === installer) &&
    (type === 'all' || l.type === type)
  ), [lines, from, to, client, installer, type]);

  const installerOptions = useMemo(() => {
    const map = new Map<string, string>();
    lines.forEach(l => map.set(l.installerId, l.installerName));
    return [...map.entries()];
  }, [lines]);

  const totals = useMemo(() => {
    const hours = filtered.filter(l => l.type === 'time').reduce((s, l) => s + l.hours, 0);
    const labour = filtered.filter(l => l.type === 'time').reduce((s, l) => s + l.amount, 0);
    const expense = filtered.filter(l => l.type === 'expense').reduce((s, l) => s + l.amount, 0);
    const mileage = filtered.filter(l => l.type === 'mileage').reduce((s, l) => s + l.amount, 0);
    const net = labour + expense + mileage;
    const vatPct = client !== 'all' ? ratesForClient(client).vatPercent : DEFAULT_CLIENT_RATES.vatPercent;
    const vat = net * (vatPct / 100);
    return { hours, labour, expense, mileage, net, vat, vatPct, gross: net + vat };
  }, [filtered, client]);

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, Line[]>>();
    filtered.forEach(l => {
      if (!map.has(l.clientName)) map.set(l.clientName, new Map());
      const byProject = map.get(l.clientName)!;
      if (!byProject.has(l.projectName)) byProject.set(l.projectName, []);
      byProject.get(l.projectName)!.push(l);
    });
    return [...map.entries()];
  }, [filtered]);

  const flags = useMemo(() => {
    const reported = new Set(lines.map(l => l.projectId));
    const missing = mockProjects.filter(p => p.status === 'completed' && !reported.has(p.id));
    const noNote = filtered.filter(l => l.type === 'expense' && !l.detail.includes('·'));
    return { missing, noNote };
  }, [lines, filtered]);

  const exportXlsx = () => {
    if (filtered.length === 0) { toast.error('Nothing to export'); return; }
    const summary = grouped.flatMap(([cl, byProject]) =>
      [...byProject.entries()].map(([proj, ls]) => ({
        Client: cl,
        Project: proj,
        Hours: ls.filter(l => l.type === 'time').reduce((s, l) => s + l.hours, 0),
        'Labour (SEK)': Math.round(ls.filter(l => l.type === 'time').reduce((s, l) => s + l.amount, 0)),
        'Expenses (SEK)': Math.round(ls.filter(l => l.type === 'expense').reduce((s, l) => s + l.amount, 0)),
        'Mileage (SEK)': Math.round(ls.filter(l => l.type === 'mileage').reduce((s, l) => s + l.amount, 0)),
        'Total ex VAT (SEK)': Math.round(ls.reduce((s, l) => s + l.amount, 0)),
      })));
    const items = filtered.map(l => ({
      Date: l.date, Type: l.type, Client: l.clientName, Project: l.projectName,
      Installer: l.installerName, Hours: l.hours || '', Km: l.km || '', Rate: l.rate || '',
      'Amount ex VAT (SEK)': Math.round(l.amount), Details: l.detail,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items), 'Line items');
    XLSX.writeFile(wb, `invoicing-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportCsv = () => {
    if (filtered.length === 0) { toast.error('Nothing to export'); return; }
    const header = ['Date', 'Type', 'Client', 'Project', 'Installer', 'Hours', 'Km', 'Rate', 'Amount ex VAT', 'Details'];
    const rows = filtered.map(l => [l.date, l.type, l.clientName, l.projectName, l.installerName, l.hours, l.km, l.rate, Math.round(l.amount), l.detail]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `invoicing-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Invoicing & follow-up</h1>
          <p className="text-sm text-muted-foreground">Reported time, third-party costs and mileage ready for invoicing.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> CSV</Button>
          <Button size="sm" onClick={exportXlsx}><FileSpreadsheet className="w-4 h-4 mr-1" /> XLSX</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 rounded-xl border border-border bg-card p-4">
        <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div>
          <Label className="text-xs">Client</Label>
          <Select value={client} onValueChange={setClient}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clientRegister.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Installer</Label>
          <Select value={installer} onValueChange={setInstaller}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All installers</SelectItem>
              {installerOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="time">Time</SelectItem>
              <SelectItem value="expense">Costs</SelectItem>
              <SelectItem value="mileage">Mileage</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          ['Hours', totals.hours.toFixed(1)],
          ['Labour', sek(totals.labour)],
          ['Costs', sek(totals.expense)],
          ['Mileage', sek(totals.mileage)],
          [`VAT ${totals.vatPct}%`, sek(totals.vat)],
          ['Total incl. VAT', sek(totals.gross)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {(flags.missing.length > 0 || flags.noNote.length > 0) && (
        <div className="rounded-xl border border-status-on-hold/40 bg-status-on-hold/10 p-4 space-y-1">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Follow-up
          </p>
          {flags.missing.length > 0 && (
            <p className="text-xs text-muted-foreground">{flags.missing.length} completed project(s) with no reporting: {flags.missing.slice(0, 5).map(p => p.name).join(', ')}</p>
          )}
          {flags.noNote.length > 0 && (
            <p className="text-xs text-muted-foreground">{flags.noNote.length} cost entr(ies) without note or receipt reference.</p>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reported entries for this selection.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([clientName, byProject]) => (
            <div key={clientName} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">{clientName}</h2>
                <span className="text-sm font-medium text-foreground">
                  {sek([...byProject.values()].flat().reduce((s, l) => s + l.amount, 0))}
                </span>
              </div>
              {[...byProject.entries()].map(([projectName, ls]) => (
                <div key={projectName} className="border-b border-border last:border-0">
                  <div className="px-4 py-2 bg-muted/40 flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{projectName}</span>
                    <span className="text-xs text-muted-foreground">
                      {ls.filter(l => l.type === 'time').reduce((s, l) => s + l.hours, 0).toFixed(1)} h · {sek(ls.reduce((s, l) => s + l.amount, 0))}
                    </span>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {ls.map(l => (
                        <tr key={l.id} className="border-t border-border/50">
                          <td className="px-4 py-2 text-muted-foreground w-24">{l.date}</td>
                          <td className="px-2 py-2 capitalize w-20">{l.type}</td>
                          <td className="px-2 py-2 w-40">{l.installerName}</td>
                          <td className="px-2 py-2 text-muted-foreground">{l.detail}</td>
                          <td className="px-4 py-2 text-right font-medium w-28">{sek(l.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InvoicingView;
