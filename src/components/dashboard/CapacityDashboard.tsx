import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Gauge, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInstallersList, useProjects } from '@/lib/appData';
import { computeCapacity, type CapacityLevel } from '@/lib/capacity';
import { statusLabels } from '@/data/mockData';
import ProfitabilityAlerts from '@/components/dashboard/ProfitabilityAlerts';

type RangeKey = 'week' | 'next-week' | 'month';

const rangeOptions: { id: RangeKey; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: 'next-week', label: 'Next week' },
  { id: 'month', label: 'This month' },
];

const levelText: Record<CapacityLevel, string> = {
  green: 'text-status-completed',
  yellow: 'text-status-in-progress',
  red: 'text-destructive',
};

const levelBg: Record<CapacityLevel, string> = {
  green: 'bg-status-completed',
  yellow: 'bg-status-in-progress',
  red: 'bg-destructive',
};

const levelChip: Record<CapacityLevel, string> = {
  green: 'bg-status-completed/15 text-status-completed border-status-completed/30',
  yellow: 'bg-status-in-progress/15 text-status-in-progress border-status-in-progress/30',
  red: 'bg-destructive/15 text-destructive border-destructive/30',
};

const levelLabel: Record<CapacityLevel, string> = {
  green: 'Healthy',
  yellow: 'Tight',
  red: 'Over capacity',
};

function startOfWeek(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const wd = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() - wd);
  return date;
}

function resolveRange(key: RangeKey): { start: Date; end: Date; label: string } {
  const now = new Date();
  if (key === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end, label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
  }
  const start = startOfWeek(now);
  if (key === 'next-week') start.setDate(start.getDate() + 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return { start, end, label: `${fmt(start)} – ${fmt(end)}` };
}

const Metric = ({
  icon: Icon,
  label,
  value,
  sub,
  level,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  sub?: string;
  level?: CapacityLevel;
}) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
      <Icon className={cn('w-4 h-4', level ? levelText[level] : 'text-muted-foreground')} />
      {label}
    </div>
    <p className={cn('mt-2 text-3xl font-bold', level ? levelText[level] : 'text-foreground')}>{value}</p>
    {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const CapacityDashboard = () => {
  const [projects] = useProjects();
  const installers = useInstallersList();
  const [rangeKey, setRangeKey] = useState<RangeKey>('week');

  const { start, end, label } = useMemo(() => resolveRange(rangeKey), [rangeKey]);
  const summary = useMemo(
    () => computeCapacity(installers, projects, start, end),
    [installers, projects, start, end],
  );

  const unassignedLevel: CapacityLevel =
    summary.unassignedJobs.length === 0 ? 'green' : summary.unassignedJobs.length <= 2 ? 'yellow' : 'red';

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-6 py-5 border-b border-border bg-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Resource Capacity</h2>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {rangeOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setRangeKey(opt.id)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                rangeKey === opt.id
                  ? 'bg-secondary text-secondary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            icon={Gauge}
            label="Utilization rate"
            value={`${summary.utilization}%`}
            sub={levelLabel[summary.level]}
            level={summary.level}
          />
          <Metric
            icon={CheckCircle2}
            label="Available hours"
            value={`${Math.max(0, Math.round((summary.totalAvailable - summary.totalScheduled) * 10) / 10)} h`}
            sub={`${summary.totalAvailable} h total capacity`}
          />
          <Metric
            icon={Clock}
            label="Scheduled hours"
            value={`${summary.totalScheduled} h`}
            sub={`${installers.length} technician${installers.length === 1 ? '' : 's'}`}
          />
          <Metric
            icon={AlertTriangle}
            label="Overtime risk"
            value={summary.overtimeHours > 0 ? `${summary.overtimeHours} h` : 'None'}
            sub={`${summary.atRiskCount} technician(s) over capacity`}
            level={summary.atRiskCount > 0 ? 'red' : summary.utilization >= 90 ? 'yellow' : 'green'}
          />
          <Metric
            icon={UserX}
            label="Unassigned jobs"
            value={`${summary.unassignedJobs.length}`}
            sub={`${summary.unassignedHours} h of unplanned work`}
            level={unassignedLevel}
          />
        </div>

        <ProfitabilityAlerts />

        <div className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Capacity per technician</h3>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-completed" /> under 85%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-status-in-progress" /> 85–100%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> over 100%</span>
            </div>
          </div>
          {summary.rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No technicians yet — add people to see capacity.</p>
          ) : (
            <div className="divide-y divide-border">
              {summary.rows.map(row => (
                <div key={row.installer.id} className="px-4 py-3 grid gap-3 sm:grid-cols-[1fr_auto] items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">{row.installer.name}</span>
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', levelChip[row.level])}>
                        {levelLabel[row.level]}
                      </span>
                      {row.absenceDays > 0 && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" /> {row.absenceDays} absence day(s)
                        </span>
                      )}
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', levelBg[row.level])}
                        style={{ width: `${Math.min(100, row.utilization)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-5 text-xs text-muted-foreground sm:justify-end">
                    <div>
                      <p className={cn('text-base font-semibold', levelText[row.level])}>{row.utilization}%</p>
                      <p>utilization</p>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">{row.scheduledHours} h</p>
                      <p>scheduled</p>
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        {Math.max(0, Math.round((row.availableHours - row.scheduledHours) * 10) / 10)} h
                      </p>
                      <p>available</p>
                    </div>
                    <div>
                      <p className={cn('text-base font-semibold', levelText[row.overtimeRisk])}>
                        {row.overtimeHours > 0 ? `${row.overtimeHours} h` : '—'}
                      </p>
                      <p>overtime</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Unassigned jobs in this period ({summary.unassignedJobs.length})
            </h3>
          </div>
          {summary.unassignedJobs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Everything in this period has someone assigned.</p>
          ) : (
            <div className="divide-y divide-border">
              {summary.unassignedJobs.map(p => (
                <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.client} · {p.location || '—'} · {statusLabels[p.status]}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">
                    {p.startDate.slice(0, 10)} → {p.endDate.slice(0, 10)}
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

export default CapacityDashboard;
