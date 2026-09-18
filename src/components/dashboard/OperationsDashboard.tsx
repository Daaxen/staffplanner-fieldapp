import { useMemo, useState } from 'react';
import {
  Activity,
  CalendarX2,
  CheckCircle2,
  FileWarning,
  Receipt,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn } from '@/lib/utils';
import { useProjects } from '@/lib/appData';
import { useFieldReportStates } from '@/hooks/useFieldReportStates';
import { computeOperations, type OpsBucket } from '@/lib/operations';
import { statusLabels, type ProjectStatus } from '@/data/mockData';

const cards: {
  id: OpsBucket;
  label: string;
  icon: typeof Activity;
  tone: string;
  bar: string;
  hint: string;
}[] = [
  {
    id: 'in-progress',
    label: 'In progress',
    icon: Activity,
    tone: 'text-status-in-progress',
    bar: 'hsl(var(--status-in-progress))',
    hint: 'Jobs currently being worked on',
  },
  {
    id: 'delayed',
    label: 'Delayed',
    icon: CalendarX2,
    tone: 'text-destructive',
    bar: 'hsl(var(--destructive))',
    hint: 'Past their end date and not finished',
  },
  {
    id: 'missing-docs',
    label: 'Missing documentation',
    icon: FileWarning,
    tone: 'text-status-on-hold',
    bar: 'hsl(var(--status-on-hold))',
    hint: 'Finished on site, report or photos missing',
  },
  {
    id: 'awaiting-approval',
    label: 'Awaiting customer approval',
    icon: CheckCircle2,
    tone: 'text-status-scheduled',
    bar: 'hsl(var(--status-scheduled))',
    hint: 'Reported but not signed off by the customer',
  },
  {
    id: 'awaiting-invoice',
    label: 'Awaiting invoice',
    icon: Receipt,
    tone: 'text-status-completed',
    bar: 'hsl(var(--status-completed))',
    hint: 'Approved and ready to be invoiced',
  },
];

const statusBarColor: Record<string, string> = {
  open: 'hsl(var(--status-open))',
  scheduled: 'hsl(var(--status-scheduled))',
  'in-progress': 'hsl(var(--status-in-progress))',
  'on-hold': 'hsl(var(--status-on-hold))',
  completed: 'hsl(var(--status-completed))',
  cancelled: 'hsl(var(--status-cancelled))',
};

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

const OperationsDashboard = () => {
  const [projects] = useProjects();
  const { reports, loading } = useFieldReportStates();
  const [selected, setSelected] = useState<OpsBucket>('in-progress');

  const summary = useMemo(() => computeOperations(projects, reports), [projects, reports]);

  const kpiChartData = cards.map(c => ({
    name: c.label,
    value: summary.buckets[c.id].length,
    fill: c.bar,
  }));

  const statusChartData = summary.statusCounts.map(s => ({
    name: statusLabels[s.status as ProjectStatus] ?? s.label,
    value: s.count,
    fill: statusBarColor[s.status],
  }));

  const list = summary.buckets[selected];
  const activeCard = cards.find(c => c.id === selected)!;

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-5 border-b border-border bg-card">
        <h2 className="text-lg font-semibold text-foreground">Operations Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          {summary.activeTotal} active order{summary.activeTotal === 1 ? '' : 's'}
          {loading ? ' · loading reports…' : ''}
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map(card => {
            const count = summary.buckets[card.id].length;
            const isActive = selected === card.id;
            return (
              <button
                key={card.id}
                onClick={() => setSelected(card.id)}
                className={cn(
                  'text-left rounded-xl border bg-card p-4 transition-colors',
                  isActive ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/40',
                )}
              >
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <card.icon className={cn('w-4 h-4', card.tone)} />
                  <span className="truncate">{card.label}</span>
                </div>
                <p className={cn('mt-2 text-3xl font-bold', card.tone)}>{count}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Operational pipeline</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpiChartData} margin={{ top: 8, right: 8, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip {...chartTooltip} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {kpiChartData.map(d => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Orders by status</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} margin={{ top: 8, right: 8, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip {...chartTooltip} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {statusChartData.map(d => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Started vs completed (last 8 weeks)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={summary.weekly} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip {...chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey="started"
                  name="Started"
                  stroke="hsl(var(--status-scheduled))"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="hsl(var(--status-completed))"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <activeCard.icon className={cn('w-4 h-4', activeCard.tone)} />
            <h3 className="text-sm font-semibold text-foreground">
              {activeCard.label} ({list.length})
            </h3>
          </div>
          {list.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nothing in this category right now.</p>
          ) : (
            <div className="divide-y divide-border">
              {list.map(p => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.client} · {p.location || '—'} · {statusLabels[p.status]}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {p.startDate?.slice(0, 10)} → {p.endDate?.slice(0, 10)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperationsDashboard;
