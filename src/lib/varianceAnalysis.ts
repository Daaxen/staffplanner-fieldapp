import type { JobMetric } from '@/lib/jobMetrics';
import { variancePct } from '@/lib/timeVariance';

/**
 * Deviation analysis over completed jobs (job_metrics).
 *
 * Compares planned hours against actual hours (work + travel) for every
 * finished assignment and aggregates per job type, so planning can see
 * which types are systematically under- or overestimated.
 */

export interface TypeVariance {
  /** Order type (or category when grouped by category). */
  key: string;
  jobs: number;
  plannedHours: number;
  actualHours: number;
  /** Hours above plan across these jobs (0 when under). */
  hoursOver: number;
  /** Hours below plan across these jobs (0 when over). */
  hoursUnder: number;
  /** Average deviation in percent (actual − planned) / planned. */
  avgVariancePct: number;
}

export interface MonthlyVariance {
  /** YYYY-MM of the completion date. */
  month: string;
  jobs: number;
  plannedHours: number;
  actualHours: number;
  avgVariancePct: number;
}

export interface VarianceAnalysis {
  /** Jobs with a usable plan/actual comparison. */
  comparableJobs: number;
  totalPlannedHours: number;
  totalActualHours: number;
  totalHoursOver: number;
  totalHoursUnder: number;
  avgVariancePct: number;
  /** Most underestimated types first (actual > planned). */
  underestimated: TypeVariance[];
  /** Most overestimated types first (planned > actual). */
  overestimated: TypeVariance[];
  /** Oldest month first, for trend charts. */
  trend: MonthlyVariance[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Only jobs with a positive plan can be compared. */
export const isComparable = (m: JobMetric) =>
  (m.plannedHours ?? 0) > 0 && m.totalHours > 0;

function aggregate(key: string, jobs: JobMetric[]): TypeVariance {
  const planned = jobs.reduce((s, m) => s + (m.plannedHours ?? 0), 0);
  const actual = jobs.reduce((s, m) => s + m.totalHours, 0);
  const pcts = jobs
    .map(m => variancePct(m.plannedHours, m.totalHours))
    .filter((p): p is number => p != null);
  const avgPct = pcts.length > 0 ? pcts.reduce((s, p) => s + p, 0) / pcts.length : 0;
  return {
    key,
    jobs: jobs.length,
    plannedHours: round1(planned),
    actualHours: round1(actual),
    hoursOver: round2(Math.max(actual - planned, 0)),
    hoursUnder: round2(Math.max(planned - actual, 0)),
    avgVariancePct: Math.round(avgPct),
  };
}

export function buildVarianceAnalysis(
  metrics: JobMetric[],
  groupBy: 'orderType' | 'category' = 'orderType',
  top = 10,
): VarianceAnalysis {
  const comparable = metrics.filter(isComparable);

  const byType = new Map<string, JobMetric[]>();
  for (const m of comparable) {
    const key = (groupBy === 'orderType' ? m.orderType : m.category) ?? 'Unknown';
    const list = byType.get(key) ?? [];
    list.push(m);
    byType.set(key, list);
  }
  const types = [...byType.entries()].map(([key, jobs]) => aggregate(key, jobs));

  const underestimated = types
    .filter(t => t.hoursOver > 0)
    .sort((a, b) => b.hoursOver - a.hoursOver || b.avgVariancePct - a.avgVariancePct)
    .slice(0, top);
  const overestimated = types
    .filter(t => t.hoursUnder > 0)
    .sort((a, b) => b.hoursUnder - a.hoursUnder || a.avgVariancePct - b.avgVariancePct)
    .slice(0, top);

  const byMonth = new Map<string, JobMetric[]>();
  for (const m of comparable) {
    const month = m.completedDate.slice(0, 7);
    const list = byMonth.get(month) ?? [];
    list.push(m);
    byMonth.set(month, list);
  }
  const trend = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, jobs]) => {
      const agg = aggregate(month, jobs);
      return {
        month,
        jobs: agg.jobs,
        plannedHours: agg.plannedHours,
        actualHours: agg.actualHours,
        avgVariancePct: agg.avgVariancePct,
      };
    });

  const overall = aggregate('all', comparable);
  return {
    comparableJobs: comparable.length,
    totalPlannedHours: overall.plannedHours,
    totalActualHours: overall.actualHours,
    totalHoursOver: overall.hoursOver,
    totalHoursUnder: overall.hoursUnder,
    avgVariancePct: overall.avgVariancePct,
    underestimated,
    overestimated,
    trend,
  };
}
