import { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp, Timer, BarChart3 } from 'lucide-react';
import { useJobMetrics } from '@/lib/jobMetrics';
import { buildVarianceAnalysis, type TypeVariance } from '@/lib/varianceAnalysis';
import { formatHours, formatVariance, varianceTone, varianceClass } from '@/lib/timeVariance';
import { cn } from '@/lib/utils';

const Kpi = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className={cn('text-xl font-bold text-foreground mt-1', tone)}>{value}</p>
    {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
  </div>
);

const TypeTable = ({ title, icon: Icon, rows, empty }: {
  title: string;
  icon: typeof TrendingUp;
  rows: TypeVariance[];
  empty: string;
}) => (
  <section className="rounded-xl border border-border bg-card">
    <header className="flex items-center gap-2 p-4 border-b border-border">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </header>
    {rows.length === 0 ? (
      <p className="p-4 text-xs text-muted-foreground">{empty}</p>
    ) : (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] text-muted-foreground border-b border-border">
            <th className="px-4 py-2 font-medium">Type</th>
            <th className="px-4 py-2 font-medium text-right">Jobs</th>
            <th className="px-4 py-2 font-medium text-right">Planned</th>
            <th className="px-4 py-2 font-medium text-right">Actual</th>
            <th className="px-4 py-2 font-medium text-right">Diff</th>
            <th className="px-4 py-2 font-medium text-right">Deviation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-medium text-foreground">{r.key}</td>
              <td className="px-4 py-2 text-right text-muted-foreground">{r.jobs}</td>
              <td className="px-4 py-2 text-right text-muted-foreground">{formatHours(r.plannedHours)}</td>
              <td className="px-4 py-2 text-right text-foreground">{formatHours(r.actualHours)}</td>
              <td className="px-4 py-2 text-right text-foreground">
                {r.hoursOver > 0 ? `+${formatHours(r.hoursOver)}` : `−${formatHours(r.hoursUnder)}`}
              </td>
              <td className={cn('px-4 py-2 text-right font-semibold', varianceClass[varianceTone(r.avgVariancePct)])}>
                {formatVariance(r.avgVariancePct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </section>
);

/** Deviation analysis: how planned hours hold up against reality, per job type and over time. */
const VarianceAnalysisDashboard = () => {
  const { metrics, loading } = useJobMetrics();
  const [groupBy, setGroupBy] = useState<'orderType' | 'category'>('orderType');

  const analysis = useMemo(() => buildVarianceAnalysis(metrics, groupBy), [metrics, groupBy]);
  const maxMonthHours = Math.max(1, ...analysis.trend.map(t => Math.max(t.plannedHours, t.actualHours)));

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-foreground">Deviation analysis</h2>
          <p className="text-xs text-muted-foreground">
            Planned vs actual time on completed jobs — basis for sharper estimates.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {(['orderType', 'category'] as const).map(g => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                groupBy === g ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {g === 'orderType' ? 'Order type' : 'Category'}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading history…</p>}
      {!loading && analysis.comparableJobs === 0 && (
        <p className="text-sm text-muted-foreground">
          No completed jobs with planned hours yet — the analysis fills in as orders are completed.
        </p>
      )}

      {analysis.comparableJobs > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="Compared jobs" value={String(analysis.comparableJobs)} />
            <Kpi label="Planned hours" value={formatHours(analysis.totalPlannedHours)} />
            <Kpi label="Actual hours" value={formatHours(analysis.totalActualHours)} />
            <Kpi label="Hours over plan" value={`+${formatHours(analysis.totalHoursOver)}`} tone={analysis.totalHoursOver > 0 ? 'text-destructive' : undefined} />
            <Kpi label="Hours under plan" value={`−${formatHours(analysis.totalHoursUnder)}`} tone={analysis.totalHoursUnder > 0 ? 'text-status-completed' : undefined} />
            <Kpi
              label="Average deviation"
              value={formatVariance(analysis.avgVariancePct)}
              tone={varianceClass[varianceTone(analysis.avgVariancePct)]}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <TypeTable
              title="Top 10 most underestimated"
              icon={TrendingUp}
              rows={analysis.underestimated}
              empty="No underestimated types — plans held or were generous."
            />
            <TypeTable
              title="Top 10 most overestimated"
              icon={TrendingDown}
              rows={analysis.overestimated}
              empty="No overestimated types — nothing finished clearly under plan."
            />
          </div>

          <section className="rounded-xl border border-border bg-card">
            <header className="flex items-center gap-2 p-4 border-b border-border">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Trend over time</h3>
              <span className="text-[11px] text-muted-foreground">planned vs actual hours per month</span>
            </header>
            {analysis.trend.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">No history yet.</p>
            ) : (
              <div className="p-4 space-y-2">
                {analysis.trend.map(t => (
                  <div key={t.month} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs text-muted-foreground">{t.month}</span>
                    <div className="flex-1 space-y-1">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-muted-foreground/50" style={{ width: `${(t.plannedHours / maxMonthHours) * 100}%` }} />
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', t.actualHours > t.plannedHours ? 'bg-destructive' : 'bg-status-completed')}
                          style={{ width: `${(t.actualHours / maxMonthHours) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                      {formatHours(t.plannedHours)} → {formatHours(t.actualHours)}
                    </span>
                    <span className={cn('w-14 shrink-0 text-right text-xs font-semibold', varianceClass[varianceTone(t.avgVariancePct)])}>
                      {formatVariance(t.avgVariancePct)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-4 pt-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50" />Planned</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-status-completed" />Actual (under plan)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-destructive" />Actual (over plan)</span>
                  <span className="flex items-center gap-1.5 ml-auto"><Timer className="w-3 h-3" />{analysis.trend.reduce((s, t) => s + t.jobs, 0)} jobs</span>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default VarianceAnalysisDashboard;
