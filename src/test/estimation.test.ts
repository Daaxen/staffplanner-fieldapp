import { describe, expect, it } from 'vitest';
import { estimateFromJobs, estimateForProject, median } from '@/lib/estimation';
import type { JobMetric } from '@/lib/jobMetrics';
import type { Project } from '@/data/mockData';

const metric = (over: Partial<JobMetric>): JobMetric => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  orderId: 'ORD-1',
  projectId: over.projectId ?? 'p-x',
  customer: null,
  city: null,
  orderType: null,
  category: null,
  installerIds: [],
  plannedHours: null,
  actualHours: 5,
  travelHours: 0,
  totalHours: 5,
  variancePct: null,
  plannedInstallers: 1,
  actualInstallers: 1,
  plannedDate: null,
  completedDate: '2026-09-01',
  materialCost: 0,
  jobValue: null,
  createdAt: '2026-09-01T00:00:00Z',
  ...over,
});

const project: Project = {
  id: 'proj-1',
  name: 'Test order',
  projectType: 'installation',
  templateId: 'standard',
  client: 'Acme',
  region: 'Stockholm',
  status: 'open',
  assigneeIds: ['a', 'b'],
} as unknown as Project;

describe('median', () => {
  it('handles odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe('estimateFromJobs', () => {
  it('computes median, mean, fastest, longest and sample size', () => {
    const jobs = [
      { metric: metric({ totalHours: 4 }), similarity: 90, matched: [] },
      { metric: metric({ totalHours: 6 }), similarity: 80, matched: [] },
      { metric: metric({ totalHours: 11 }), similarity: 70, matched: [] },
    ];
    const est = estimateFromJobs(jobs)!;
    expect(est.sampleSize).toBe(3);
    expect(est.medianHours).toBe(6);
    expect(est.averageHours).toBe(7);
    expect(est.fastestHours).toBe(4);
    expect(est.longestHours).toBe(11);
  });

  it('returns null when there are no similar jobs', () => {
    expect(estimateFromJobs([])).toBeNull();
  });
});

describe('estimateForProject', () => {
  const history = [
    metric({ id: 'm1', projectId: 'p1', orderType: 'installation', category: 'standard', customer: 'Acme', city: 'Stockholm', actualInstallers: 2, totalHours: 8 }),
    metric({ id: 'm2', projectId: 'p2', orderType: 'installation', category: 'standard', customer: 'Acme', city: 'Stockholm', actualInstallers: 2, totalHours: 6 }),
    metric({ id: 'm3', projectId: 'p3', orderType: 'installation', category: 'standard', customer: 'Other', city: 'Malmö', actualInstallers: 1, totalHours: 12 }),
    metric({ id: 'm4', projectId: 'p4', orderType: 'service', category: 'other', customer: 'Other', city: 'Umeå', actualInstallers: 1, totalHours: 99 }),
  ];

  it('builds an estimate from similar history', () => {
    const est = estimateForProject(project, history, 'proj-1-row')!;
    expect(est.sampleSize).toBeGreaterThanOrEqual(2);
    expect(est.fastestHours).toBeLessThanOrEqual(est.medianHours);
    expect(est.longestHours).toBeGreaterThanOrEqual(est.medianHours);
  });

  it('excludes the order itself from its own estimate', () => {
    const own = metric({ id: 'm-own', projectId: 'proj-1-row', orderType: 'installation', totalHours: 1 });
    const est = estimateForProject(project, [own, ...history], 'proj-1-row')!;
    expect(est.jobs.some(j => j.metric.id === 'm-own')).toBe(false);
  });

  it('returns null when nothing is comparable', () => {
    const alien = { ...project, projectType: 'x', templateId: 'y', client: 'z', region: 'q', assigneeIds: [] } as unknown as Project;
    expect(estimateForProject(alien, history)).toBeNull();
  });
});
