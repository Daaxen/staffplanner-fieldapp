import { useMemo, useState } from 'react';
import { FileText, Settings2, AlertTriangle, CheckCircle2, RefreshCw, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useProjects } from '@/lib/appData';
import { useProfitabilityData } from '@/hooks/useProfitabilityData';
import { useFieldReportStates } from '@/hooks/useFieldReportStates';
import { useOpenDeviations } from '@/hooks/useOpenDeviations';
import { emptyInput, sek } from '@/lib/profitability';
import {
  buildInvoiceSuggestion, loadInvoiceSettings, saveInvoiceSettings, scoreLevel, scoreColor,
  DEFAULT_INVOICE_SETTINGS, type InvoiceSettings, type InvoiceSuggestion,
} from '@/lib/invoicePrep';
import {
  canTransitionCommercial, commercialLabels, commercialStatusOf, type CommercialStatus,
} from '@/lib/commercial';

const numberField = (
  label: string,
  value: number,
  onChange: (n: number) => void,
  suffix?: string,
) => (
  <div key={label}>
    <Label className="text-xs">{label}{suffix ? ` (${suffix})` : ''}</Label>
    <Input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value) || 0)}
      className="h-8"
    />
  </div>
);

const InvoicePrepView = () => {
  const [projects, setProjects] = useProjects();
  const { inputs, loading, reload } = useProfitabilityData();
  const { reports, reload: reloadReports } = useFieldReportStates();
  const { counts, reload: reloadDeviations } = useOpenDeviations();

  const [settings, setSettings] = useState<InvoiceSettings>(loadInvoiceSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'ready' | 'blocked' | 'negative'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const update = (patch: Partial<InvoiceSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveInvoiceSettings(next);
  };

  const suggestions: InvoiceSuggestion[] = useMemo(
    () =>
      projects
        .filter(p => p.status !== 'cancelled')
        .map(p =>
          buildInvoiceSuggestion(
            p,
            {
              input: inputs[p.id] ?? emptyInput(p),
              report: reports[p.id],
              openDeviations: counts[p.id] ?? 0,
            },
            settings,
          ),
        )
        .sort((a, b) => b.score - a.score || b.revenue - a.revenue),
    [projects, inputs, reports, counts, settings],
  );

  const shown = suggestions.filter(s =>
    filter === 'all' ? true : filter === 'ready' ? s.ready : filter === 'negative' ? s.margin < 0 : !s.ready,
  );

  const totals = useMemo(
    () =>
      shown.reduce(
        (acc, s) => ({
          revenue: acc.revenue + s.revenue,
          internal: acc.internal + s.internalCost,
          external: acc.external + s.externalCost,
          mileage: acc.mileage + s.mileageCost,
          material: acc.material + s.materialCost,
          travel: acc.travel + s.travelCost,
          expenses: acc.expenses + s.expenseCost,
          margin: acc.margin + s.margin,
        }),
        { revenue: 0, internal: 0, external: 0, mileage: 0, material: 0, travel: 0, expenses: 0, margin: 0 },
      ),
    [shown],
  );

  const selected = shown.find(s => s.project.id === selectedId) ?? null;

  const setCommercial = (orderId: string, next: CommercialStatus) => {
    const order = projects.find(p => p.id === orderId);
    if (!order) return;
    const current = commercialStatusOf(order);
    if (!canTransitionCommercial(current, next)) {
      toast.error(`${commercialLabels[current]} cannot go straight to ${commercialLabels[next]}`);
      return;
    }
    setProjects(prev => prev.map(p => (p.id === orderId ? { ...p, commercialStatus: next } : p)));
    toast.success(`${order.name} set to ${commercialLabels[next]}`);
  };

  const exportXlsx = () => {
    const rows = shown.map(s => ({
      Order: s.project.name,
      Customer: s.project.client,
      Commercial: commercialLabels[s.commercialStatus],
      Hours: s.hours,
      Revenue: s.revenue,
      'Internal cost': s.internalCost,
      'External cost': s.externalCost,
      Mileage: s.mileageCost,
      'Material cost': s.materialCost,
      'Travel cost': s.travelCost,
      Expenses: s.expenseCost,
      Margin: s.margin,
      'Margin %': s.marginPct,
      Readiness: s.score,
      Warnings: s.warnings.map(w => w.label).join('; '),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoice suggestions');
    XLSX.writeFile(wb, `invoice-suggestions-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const refresh = () => { void reload(); void reloadReports(); void reloadDeviations(); };

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-5 border-b border-border bg-card flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Invoice preparation</h2>
          <p className="text-sm text-muted-foreground">
            Suggestions built from reported time, mileage, expenses and the order economy
            {loading ? ' · loading…' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={v => setFilter(v as typeof filter)}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All orders</SelectItem>
              <SelectItem value="ready">Ready to invoice</SelectItem>
              <SelectItem value="blocked">Needs attention</SelectItem>
              <SelectItem value="negative">Negative margin</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportXlsx}><Download className="w-4 h-4 mr-1" />Export</Button>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}><Settings2 className="w-4 h-4 mr-1" />Rules</Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Revenue', value: sek(totals.revenue) },
            { label: 'Internal cost', value: sek(totals.internal) },
            { label: 'External cost', value: sek(totals.external) },
            { label: 'Material cost', value: sek(totals.material) },
            { label: 'Travel cost', value: sek(totals.travel) },
            { label: 'Other expenses', value: sek(totals.expenses - totals.material) },
            { label: 'Gross margin', value: sek(totals.margin) },
            {
              label: 'Margin %',
              value: totals.revenue > 0 ? `${((totals.margin / totals.revenue) * 100).toFixed(1)} %` : '—',
            },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{c.label}</p>
              <p className="mt-2 text-xl font-bold text-foreground">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Order</th>
                <th className="px-3 py-2 text-left">Commercial</th>
                <th className="px-3 py-2 text-right">Hours</th>
                <th className="px-3 py-2 text-right">Revenue</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2 text-right">Margin</th>
                <th className="px-3 py-2 text-right">Readiness</th>
                <th className="px-3 py-2 text-left">Warnings</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No orders to prepare.</td></tr>
              )}
              {shown.map(s => (
                <tr
                  key={s.project.id}
                  onClick={() => setSelectedId(s.project.id)}
                  className={`border-t border-border hover:bg-muted/30 cursor-pointer ${s.margin < 0 ? 'bg-destructive/5' : ''}`}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-foreground">{s.project.name}</div>
                    <div className="text-[11px] text-muted-foreground">{s.project.client}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{commercialLabels[s.commercialStatus]}</td>
                  <td className="px-3 py-2 text-right">{s.hours}</td>
                  <td className="px-3 py-2 text-right">{sek(s.revenue)}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{sek(s.totalCost)}</td>
                  <td className="px-3 py-2 text-right">{sek(s.margin)} <span className="text-xs text-muted-foreground">({s.marginPct.toFixed(1)} %)</span></td>
                  <td className={cn('px-3 py-2 text-right font-semibold', scoreColor(scoreLevel(s.score)))}>
                    {s.score}
                  </td>
                  <td className="px-3 py-2">
                    {s.warnings.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs text-status-completed">
                        <CheckCircle2 className="w-3.5 h-3.5" />Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="w-3.5 h-3.5" />{s.warnings.length}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={o => !o && setSelectedId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />{selected?.project.name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Line</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.lines.length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">Nothing to invoice yet.</td></tr>
                    )}
                    {selected.lines.map(l => (
                      <tr key={l.label} className="border-t border-border">
                        <td className="px-3 py-2">{l.label}</td>
                        <td className="px-3 py-2 text-right">{l.quantity} {l.unit}</td>
                        <td className="px-3 py-2 text-right">{sek(l.rate)}</td>
                        <td className="px-3 py-2 text-right font-medium">{sek(l.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm">
                {[
                  ['Revenue', sek(selected.revenue)],
                  ['Internal cost', sek(selected.internalCost)],
                  ['External cost', sek(selected.externalCost)],
                  ['Mileage', sek(selected.mileageCost)],
                  ['Material cost', sek(selected.materialCost)],
                  ['Travel cost', sek(selected.travelCost)],
                  ['Expenses', sek(selected.expenseCost)],
                  ['Margin', `${sek(selected.margin)} (${selected.marginPct.toFixed(1)} %)`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border p-2">
                    <div className="text-[11px] text-muted-foreground uppercase">{k}</div>
                    <div className="font-medium text-foreground">{v}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Invoice readiness</span>
                  <span className={cn('text-lg font-bold', scoreColor(scoreLevel(selected.score)))}>{selected.score} / 100</span>
                </div>
                {selected.warnings.length === 0 ? (
                  <p className="text-xs text-status-completed mt-1">Everything needed is in place.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {selected.warnings.map(w => (
                      <li key={w.code} className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />{w.label} <span className="text-muted-foreground">(−{w.penalty})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setCommercial(selected.project.id, 'ready_for_invoice'); setSelectedId(null); }}
                >
                  Mark ready for invoice
                </Button>
                <Button onClick={() => { setCommercial(selected.project.id, 'invoiced'); setSelectedId(null); }}>
                  Mark invoiced
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Invoicing rules</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              {([
                ['billHours', 'Bill reported hours'],
                ['billMileage', 'Bill mileage'],
                ['billMaterials', 'Bill materials'],
                ['billTravel', 'Bill travel expenses'],
                ['billOther', 'Bill other expenses'],
              ] as [keyof InvoiceSettings, string][]).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <Label className="text-sm">{label}</Label>
                  <Switch
                    checked={settings[key] as boolean}
                    onCheckedChange={v => update({ [key]: v } as Partial<InvoiceSettings>)}
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {numberField('Expense markup', settings.expenseMarkupPct, v => update({ expenseMarkupPct: v }), '%')}
              {numberField('Mileage markup', settings.mileageMarkupPct, v => update({ mileageMarkupPct: v }), '%')}
              {numberField('Internal hourly cost', settings.internalHourlyCost, v => update({ internalHourlyCost: v }), 'SEK/h')}
              {numberField('External hourly cost', settings.externalHourlyCost, v => update({ externalHourlyCost: v }), 'SEK/h')}
              {numberField('Target margin', settings.targetMarginPct, v => update({ targetMarginPct: v }), '%')}
              {numberField('Ready at score', settings.readyThreshold, v => update({ readyThreshold: v }))}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Readiness deductions</p>
              <div className="grid grid-cols-2 gap-3">
                {numberField('Missing report', settings.penaltyMissingReport, v => update({ penaltyMissingReport: v }))}
                {numberField('Missing sign-off', settings.penaltyMissingSignOff, v => update({ penaltyMissingSignOff: v }))}
                {numberField('Open deviation', settings.penaltyOpenDeviation, v => update({ penaltyOpenDeviation: v }))}
                {numberField('No hours reported', settings.penaltyNoHours, v => update({ penaltyNoHours: v }))}
                {numberField('Margin below target', settings.penaltyLowMargin, v => update({ penaltyLowMargin: v }))}
                {numberField('Negative margin', settings.penaltyNegativeMargin, v => update({ penaltyNegativeMargin: v }))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSettings(DEFAULT_INVOICE_SETTINGS); saveInvoiceSettings(DEFAULT_INVOICE_SETTINGS); }}>
              Reset to defaults
            </Button>
            <Button onClick={() => setSettingsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InvoicePrepView;
