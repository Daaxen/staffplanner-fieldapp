import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, TrendingUp, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects } from '@/lib/appData';
import { useProfitabilityData } from '@/hooks/useProfitabilityData';
import { statusLabels } from '@/data/mockData';
import {
  DEFAULT_EXTERNAL_HOURLY_COST,
  DEFAULT_INTERNAL_HOURLY_COST,
  DEFAULT_TARGET_MARGIN_PCT,
  alertBg,
  alertColor,
  computeProfitability,
  emptyInput,
  marginBg,
  marginColor,
  marginLevel,
  pctLabel,
  profitabilityAlerts,
  sek,
} from '@/lib/profitability';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const ProfitabilityView = () => {
  const [projects, setProjects] = useProjects();
  const { inputs, loading, reload: load } = useProfitabilityData();
  const [client, setClient] = useState('all');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [onlyAlerts, setOnlyAlerts] = useState(false);



  const rows = useMemo(() => {
    return projects
      .filter(p => p.status !== 'cancelled')
      .filter(p => (client === 'all' ? true : p.client === client))
      .filter(p => (status === 'all' ? true : p.status === status))
      .filter(p => (from ? p.endDate >= from : true))
      .filter(p => (to ? p.startDate <= to : true))
      .map(p => {
        const input = { ...(inputs[p.id] ?? emptyInput(p)), project: p };
        const result = computeProfitability(input);
        return { project: p, result, input, alerts: profitabilityAlerts(p, result) };
      })
      .filter(r => (onlyAlerts ? r.alerts.length > 0 : true))
      .sort((a, b) => a.result.profitabilityPct - b.result.profitabilityPct);
  }, [projects, inputs, client, status, from, to, onlyAlerts]);

  const alertCount = rows.reduce((n, r) => n + r.alerts.length, 0);

  const totals = useMemo(() => {
    const acc = rows.reduce(
      (a, r) => {
        a.revenue += r.result.revenue;
        a.budgetHours += r.result.budgetHours;
        a.actualHours += r.result.actualHours;
        a.internalCost += r.result.internalCost;
        a.externalCost += r.result.externalCost;
        a.travelCost += r.result.travelCost;
        a.materialCost += r.result.materialCost;
        a.grossMargin += r.result.grossMargin;
        a.contributionMargin += r.result.contributionMargin;
        return a;
      },
      {
        revenue: 0,
        budgetHours: 0,
        actualHours: 0,
        internalCost: 0,
        externalCost: 0,
        travelCost: 0,
        materialCost: 0,
        grossMargin: 0,
        contributionMargin: 0,
      },
    );
    return {
      ...acc,
      grossMarginPct: acc.revenue > 0 ? (acc.grossMargin / acc.revenue) * 100 : 0,
      profitabilityPct: acc.revenue > 0 ? (acc.contributionMargin / acc.revenue) * 100 : 0,
    };
  }, [rows]);

  const clients = useMemo(
    () => Array.from(new Set(projects.map(p => p.client).filter(Boolean))).sort(),
    [projects],
  );

  const open = rows.find(r => r.project.id === openId);

  const saveEconomy = (projectId: string, patch: Record<string, number | undefined>) => {
    setProjects(prev =>
      prev.map(p => (p.id === projectId ? { ...p, economy: { ...(p.economy ?? {}), ...patch } } : p)),
    );
  };

  const exportXlsx = () => {
    const data = rows.map(r => ({
      Order: r.project.id,
      Name: r.project.name,
      Client: r.project.client,
      Status: statusLabels[r.project.status],
      Revenue: Math.round(r.result.revenue),
      'Budget hours': r.result.budgetHours,
      'Actual hours': r.result.actualHours,
      'Internal cost': Math.round(r.result.internalCost),
      'External cost': Math.round(r.result.externalCost),
      'Travel cost': Math.round(r.result.travelCost),
      'Material cost': Math.round(r.result.materialCost),
      'Gross margin': Math.round(r.result.grossMargin),
      'Gross margin %': Number(r.result.grossMarginPct.toFixed(1)),
      'Contribution margin': Math.round(r.result.contributionMargin),
      'Profitability %': Number(r.result.profitabilityPct.toFixed(1)),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Profitability');
    XLSX.writeFile(wb, `profitability-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('Exported');
  };

  const metric = (label: string, value: string, tone?: string) => (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold mt-0.5', tone ?? 'text-foreground')}>{value}</p>
    </div>
  );

  const numberField = (
    label: string,
    value: number | undefined,
    placeholder: string,
    onSave: (n: number | undefined) => void,
  ) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        inputMode="decimal"
        defaultValue={value ?? ''}
        placeholder={placeholder}
        onBlur={e => {
          const raw = e.target.value.trim();
          onSave(raw === '' ? undefined : Number(raw));
        }}
      />
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Project Profitability
          </h1>
          <p className="text-sm text-muted-foreground">
            Revenue, hours and costs per order with gross margin, contribution margin and profitability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={exportXlsx} disabled={rows.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
        {metric('Revenue', sek(totals.revenue))}
        {metric('Budget hours', `${Math.round(totals.budgetHours)} h`)}
        {metric(
          'Actual hours',
          `${Math.round(totals.actualHours)} h`,
          totals.actualHours > totals.budgetHours ? 'text-status-cancelled' : 'text-status-completed',
        )}
        {metric('Total cost', sek(totals.internalCost + totals.externalCost + totals.travelCost + totals.materialCost))}
        {metric('Gross margin', `${sek(totals.grossMargin)} · ${pctLabel(totals.grossMarginPct)}`, marginColor(marginLevel(totals.grossMarginPct)))}
        {metric('Profitability', pctLabel(totals.profitabilityPct), marginColor(marginLevel(totals.profitabilityPct)))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Client</Label>
          <Select value={client} onValueChange={setClient}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
        </div>
        <Button
          variant={onlyAlerts ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOnlyAlerts(v => !v)}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          {onlyAlerts ? 'Showing alerts only' : `Alerts (${alertCount})`}
        </Button>
      </div>

      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Order</th>
              <th className="text-right font-medium px-3 py-2">Revenue</th>
              <th className="text-right font-medium px-3 py-2">Budget h</th>
              <th className="text-right font-medium px-3 py-2">Actual h</th>
              <th className="text-right font-medium px-3 py-2">Internal</th>
              <th className="text-right font-medium px-3 py-2">External</th>
              <th className="text-right font-medium px-3 py-2">Travel</th>
              <th className="text-right font-medium px-3 py-2">Material</th>
              <th className="text-right font-medium px-3 py-2">Gross margin</th>
              <th className="text-right font-medium px-3 py-2">Contribution</th>
              <th className="text-right font-medium px-3 py-2">Profit %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ project, result, alerts }) => {
              const level = marginLevel(result.profitabilityPct);
              const worst = alerts.some(a => a.severity === 'critical') ? 'critical' : 'warning';
              return (
                <tr
                  key={project.id}
                  onClick={() => setOpenId(project.id)}
                  className="border-t border-border cursor-pointer hover:bg-muted/40"
                >
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground flex items-center gap-1.5">
                      {project.name}
                      {alerts.length > 0 && (
                        <span
                          title={alerts.map(a => a.title).join(' · ')}
                          className={cn('inline-flex items-center gap-1 text-[11px] font-semibold rounded-full border px-1.5 py-0.5', alertBg(worst), alertColor(worst))}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {alerts.length}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {project.id} · {project.client || 'No client'} · {statusLabels[project.status]}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right">{sek(result.revenue)}</td>
                  <td className="px-3 py-2 text-right">{result.budgetHours || '—'}</td>
                  <td className={cn('px-3 py-2 text-right', result.hoursVariance > 0 && 'text-status-cancelled')}>
                    {result.actualHours || '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{sek(result.internalCost)}</td>
                  <td className="px-3 py-2 text-right">{sek(result.externalCost)}</td>
                  <td className="px-3 py-2 text-right">{sek(result.travelCost)}</td>
                  <td className="px-3 py-2 text-right">{sek(result.materialCost)}</td>
                  <td className="px-3 py-2 text-right">
                    {sek(result.grossMargin)}{' '}
                    <span className="text-xs text-muted-foreground">{pctLabel(result.grossMarginPct)}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{sek(result.contributionMargin)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', marginBg(level), marginColor(level))}>
                      {pctLabel(result.profitabilityPct)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-10 text-center text-muted-foreground">
                  No orders match the filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/70 flex justify-end" onClick={() => setOpenId(null)}>
          <div
            className="w-full max-w-md h-full overflow-auto bg-card border-l border-border p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-foreground">{open.project.name}</h2>
                <p className="text-xs text-muted-foreground">{open.project.id} · {open.project.client}</p>
              </div>
              <button onClick={() => setOpenId(null)} aria-label="Close" className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {metric('Revenue', sek(open.result.revenue))}
              {metric('Total cost', sek(open.result.totalCost))}
              {metric('Gross margin', pctLabel(open.result.grossMarginPct), marginColor(marginLevel(open.result.grossMarginPct)))}
              {metric('Contribution margin', pctLabel(open.result.contributionMarginPct), marginColor(marginLevel(open.result.contributionMarginPct)))}
            </div>

            <div className="rounded-xl border border-border p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Internal hours</span><span>{open.input.internalHours} h</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sub-vendor hours</span><span>{open.input.externalHours} h</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Budget hours</span><span>{open.result.budgetHours} h</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Mileage</span><span>{Math.round(open.input.mileageKm)} km</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Logged material</span><span>{sek(open.input.materialExpenses)}</span></div>
            </div>

            <p className="text-xs font-semibold text-foreground">Adjust the numbers for this order</p>
            <div className="grid grid-cols-2 gap-3">
              {numberField('Fixed price (ex VAT)', open.project.economy?.fixedPrice, 'From hours', v => saveEconomy(open.project.id, { fixedPrice: v }))}
              {numberField('Extra revenue', open.project.economy?.additionalRevenue, '0', v => saveEconomy(open.project.id, { additionalRevenue: v }))}
              {numberField('Budget hours', open.project.economy?.budgetHours, String(open.project.estimatedHours ?? 0), v => saveEconomy(open.project.id, { budgetHours: v }))}
              {numberField('Internal cost / h', open.project.economy?.internalHourlyCost, String(DEFAULT_INTERNAL_HOURLY_COST), v => saveEconomy(open.project.id, { internalHourlyCost: v }))}
              {numberField('Sub-vendor cost / h', open.project.economy?.externalHourlyCost, String(DEFAULT_EXTERNAL_HOURLY_COST), v => saveEconomy(open.project.id, { externalHourlyCost: v }))}
              {numberField('Extra external cost', open.project.economy?.externalCostExtra, '0', v => saveEconomy(open.project.id, { externalCostExtra: v }))}
              {numberField('Extra material cost', open.project.economy?.materialCostExtra, '0', v => saveEconomy(open.project.id, { materialCostExtra: v }))}
              {numberField('Extra travel cost', open.project.economy?.travelCostExtra, '0', v => saveEconomy(open.project.id, { travelCostExtra: v }))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Changes save automatically when you leave a field.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitabilityView;
