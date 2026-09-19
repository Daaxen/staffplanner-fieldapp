import { describe, expect, it } from 'vitest';
import { buildVarianceAnalysis, isComparable } from '@/lib/varianceAnalysis';
import type { JobMetric } from '@/lib/jobMetrics';

const metric = (over: Partial<JobMetric>): JobMetric => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  orderId: 'ORD-1',
  projectId: 'p',
  customer: 'Acme',
  city: 'Stockholm',
  orderType: 'installation',
  category: 'standard',
  installerIds: [],
  plannedHours: 10,
  actualHours: 10,
  travelHours: 0,
  totalHours: 10,
  variancePct: 0,
  plannedInstallers: 1,
  actualInstallers: 1,
  plannedDate: null,
  completedDate: '2026-08-15',
  materialCost: 0,
  jobValue: null,
  createdAt: '2026-08-15T00:00:00Z',
  ...over,
});

describe('isComparable', () => {
  it('requires a positive plan and actual time', () => {
    expect(isComparable(metric({}))).toBe(true);
    expect(isComparable(metric({ plannedHours: null }))).toBe(false);
    expect(isComparable(metric({ plannedHours: 0 }))).toBe(false);
    expect(isComparable(metric({ totalHours: 0 }))).toBe(false);
  });
});

describe('buildVarianceAnalysis', () => {
  const history = [
    // installations run over plan
    metric({ id: 'a', plannedHours: 10, totalHours: 14, completedDate: '2026-07-10' }),
    metric({ id: 'b', plannedHours: 8, totalHours: 10, completedDate: '2026-08-11' }),
    // service jobs run under plan
    metric({ id: 'c', orderType: 'service', plannedHours: 6, totalHours: 4, completedDate: '2026-08-20' }),
    metric({ id: 'd', orderType: 'service', plannedHours: 10, totalHours: 8, completedDate: '2026-09-02' }),
    // not comparable
    metric({ id: 'e', plannedHours: null, totalHours: 5 }),
  ];

  it('computes totals: over, under and average deviation', () => {
    const a = buildVarianceAnalysis(history);
    expect(a.comparableJobs).toBe(4);
    expect(a.totalPlannedHours).toBe(34);
    expect(a.totalActualHours).toBe(36);
    expect(a.totalHoursOver).toBe(2);
    expect(a.totalHoursUnder).toBe(0);
    // per-job deviations: +40%, +25%, -33%, -20% → avg 3%
    expect(a.avgVariancePct).toBe(3);
  });

  it('ranks underestimated and overestimated types separately', () => {
    const a = buildVarianceAnalysis(history);
    expect(a.underestimated.map(t => t.key)).toEqual(['installation']);
    expect(a.underestimated[0].hoursOver).toBe(6);
    expect(a.underestimated[0].hoursUnder).toBe(0);
    expect(a.overestimated.map(t => t.key)).toEqual(['service']);
    expect(a.overestimated[0].hoursUnder).toBe(4);
    expect(a.overestimated[0].avgVariancePct).toBeLessThan(0);
  });

  it('builds a monthly trend, oldest first', () => {
    const a = buildVarianceAnalysis(history);
    expect(a.trend.map(t => t.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(a.trend[0].jobs).toBe(1);
    expect(a.trend[1].plannedHours).toBe(14); // b + c
    expect(a.trend[1].actualHours).toBe(14);
  });

  it('handles empty history', () => {
    const a = buildVarianceAnalysis([]);
    expect(a.comparableJobs).toBe(0);
    expect(a.underestimated).toEqual([]);
    expect(a.trend).toEqual([]);
  });

  it('limits lists to the requested top N', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      metric({ id: `t${i}`, orderType: `type-${i}`, plannedHours: 5, totalHours: 6 + i }));
    const a = buildVarianceAnalysis(many, 'orderType', 10);
    expect(a.underestimated).toHaveLength(10);
    expect(a.underestimated[0].hoursOver).toBeGreaterThanOrEqual(a.underestimated[9].hoursOver);
  });
});
