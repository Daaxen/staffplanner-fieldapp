import { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, CalendarCheck2, CheckCircle2, Gauge, PieChart, Smile, TrendingUp } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useProjects, useInstallersList } from '@/lib/appData';
import { useProfitabilityData } from '@/hooks/useProfitabilityData';
import { useFieldReportStates } from '@/hooks/useFieldReportStates';
import { computeCapacity } from '@/lib/capacity';
import {
  computeProfitability,
  emptyInput,
  marginColor,
  marginLevel,
  pctLabel,
  sek,
} from '@/lib/profitability';
import type { Project } from '@/data/mockData';

const chartTooltip = {
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 12,
    color: 'hsl(var(--foreground))',
  },
  labelStyle: { color: 'hsl(var(--muted-foreground))' },
};

const monthKey = (iso?: string) => (iso ? iso.slice(0, 7) : '');

const lastMonths = (count: number) => {
  const now = new Date();
  const out: { key: string; label: string }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
    });
  }
  return out;
};

const Kpi = ({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
      <Icon className={cn('w-4 h-4', tone ?? 'text-muted-foreground')} />
      <span className="truncate">{label}</span>
    </div>
    <p className={cn('mt-2 text-2xl font-bold', tone ?? 'text-foreground')}>{value}</p>
    {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const ExecutiveDashboard = () => {
  const [projects] = useProjects();
  const installers = useInstallersList();
  const { inputs } = useProfitabilityData();
  const { reports } = useFieldReportStates();
  const [deviationRefs, setDeviationRefs] = useState<Set<string>>(new Set());

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('deviations').select('project_id,project_ref,severity');
      setDeviationRefs(
        new Set(
          (data ?? []).map(
            d => projectRefForRowId(d.project_id as string) ?? (d.project_ref as string),
          ),
        ),
      );
    })();
  }, []);

  const months = useMemo(() => lastMonths(12), []);
  const thisMonth = months[months.length - 1].key;

  const results = useMemo(
    () =>
      projects
        .filter(p => p.status !== 'cancelled')
        .map(p => ({
          project: p,
          result: computeProfitability(inputs[p.id] ?? emptyInput(p)),
        })),
    [projects, inputs],
  );

  const monthOf = (p: Project) => monthKey(p.endDate || p.startDate);

  const monthly = useMemo(
    () =>
      months.map(m => {
        const rows = results.filter(r => monthOf(r.project) === m.key);
        const revenue = rows.reduce((s, r) => s + r.result.revenue, 0);
        const grossMargin = rows.reduce((s, r) => s + r.result.grossMargin, 0);
        const profit = rows.reduce((s, r) => s + r.result.contributionMargin, 0);
        const completed = rows.filter(r => r.project.status === 'completed').length;
        return {
          month: m.label,
          revenue: Math.round(revenue),
          grossMargin: Math.round(grossMargin),
          grossMarginPct: revenue > 0 ? Number(((grossMargin / revenue) * 100).toFixed(1)) : 0,
          avgProfit: rows.length > 0 ? Math.round(profit / rows.length) : 0,
          booked: rows.length,
          completed,
        };
      }),
    [months, results],
  );

  const current = useMemo(() => {
    const rows = results.filter(r => monthOf(r.project) === thisMonth);
    const revenue = rows.reduce((s, r) => s + r.result.revenue, 0);
    const grossMargin = rows.reduce((s, r) => s + r.result.grossMargin, 0);
    const profit = rows.reduce((s, r) => s + r.result.contributionMargin, 0);
    return {
      revenue,
      grossMargin,
      grossMarginPct: revenue > 0 ? (grossMargin / revenue) * 100 : 0,
      booked: rows.length,
      completed: rows.filter(r => r.project.status === 'completed').length,
      avgProfit: rows.length > 0 ? profit / rows.length : 0,
    };
  }, [results, thisMonth]);

  const prev = monthly[monthly.length - 2];
  const revenueTrend =
    prev && prev.revenue > 0 ? ((current.revenue - prev.revenue) / prev.revenue) * 100 : null;

  const utilization = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return computeCapacity(installers, projects, start, end);
  }, [installers, projects]);

  const satisfaction = useMemo(() => {
    const completed = projects.filter(p => p.status === 'completed');
    if (completed.length === 0) return { score: null as number | null, base: 0 };
    const happy = completed.filter(
      p => reports[p.id]?.hasSignature && !deviationRefs.has(p.id),
    ).length;
    return { score: (happy / completed.length) * 100, base: completed.length };
  }, [projects, reports, deviationRefs]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-5 border-b border-border bg-card">
        <h2 className="text-lg font-semibold text-foreground">Executive Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · rolling 12 month trends
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            icon={BadgeDollarSign}
            label="Revenue this month"
            value={sek(current.revenue)}
            sub={
              revenueTrend === null
                ? 'No comparable previous month'
                : `${revenueTrend >= 0 ? '+' : ''}${revenueTrend.toFixed(1)} % vs last month`
            }
            tone="text-status-completed"
          />
          <Kpi
            icon={PieChart}
            label="Gross margin"
            value={pctLabel(current.grossMarginPct)}
            sub={sek(current.grossMargin)}
            tone={marginColor(marginLevel(current.grossMarginPct))}
          />
          <Kpi
            icon={CalendarCheck2}
            label="Booked projects"
            value={`${current.booked}`}
            sub="Orders scheduled in this month"
            tone="text-status-scheduled"
          />
          <Kpi
            icon={CheckCircle2}
            label="Completed projects"
            value={`${current.completed}`}
            sub="Finished this month"
            tone="text-status-completed"
          />
          <Kpi
            icon={TrendingUp}
            label="Average project profit"
            value={sek(current.avgProfit)}
            sub="Contribution margin per order"
            tone={current.avgProfit >= 0 ? 'text-status-completed' : 'text-destructive'}
          />
          <Kpi
            icon={Gauge}
            label="Technician utilization"
            value={`${utilization.utilization} %`}
            sub={`${utilization.totalScheduled} h of ${utilization.totalAvailable} h this month`}
            tone={
              utilization.level === 'green'
                ? 'text-status-completed'
                : utilization.level === 'yellow'
                  ? 'text-status-in-progress'
                  : 'text-destructive'
            }
          />
          <Kpi
            icon={Smile}
            label="Customer satisfaction"
            value={satisfaction.score === null ? '—' : `${satisfaction.score.toFixed(0)} %`}
            sub={
              satisfaction.base === 0
                ? 'No completed orders yet'
                : `${satisfaction.base} completed order(s), signed off without deviations`
            }
            tone={
              satisfaction.score === null
                ? undefined
                : satisfaction.score >= 90
                  ? 'text-status-completed'
                  : satisfaction.score >= 70
                    ? 'text-status-in-progress'
                    : 'text-destructive'
            }
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Revenue & gross margin per month</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthly} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--status-scheduled))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--status-scheduled))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gmFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--status-completed))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--status-completed))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={70} />
                <Tooltip {...chartTooltip} formatter={(v: number) => sek(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="hsl(var(--status-scheduled))"
                  fill="url(#revFill)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="grossMargin"
                  name="Gross margin"
                  stroke="hsl(var(--status-completed))"
                  fill="url(#gmFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Booked vs completed projects</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip {...chartTooltip} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="booked" name="Booked" fill="hsl(var(--status-scheduled))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="hsl(var(--status-completed))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Average project profit & margin %
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthly} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={60} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    width={40}
                  />
                  <Tooltip {...chartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="avgProfit"
                    name="Avg profit (SEK)"
                    stroke="hsl(var(--status-in-progress))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="grossMarginPct"
                    name="Gross margin %"
                    stroke="hsl(var(--status-open))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
