import { describe, expect, it } from 'vitest';
import type { JobMetric } from '@/lib/jobMetrics';
import { averageActualHours, findSimilarJobs, scoreSimilarity, SIMILARITY_WEIGHTS, type SimilarJobTarget } from '@/lib/similarJobs';

const metric = (over: Partial<JobMetric>): JobMetric => ({
  id: over.id ?? 'm1',
  orderId: 'P-1',
  projectId: over.projectId ?? 'uuid-1',
  customer: 'ICA',
  city: 'Stockholm',
  orderType: 'installation',
  category: 'shelf',
  installerIds: [],
  plannedHours: 6,
  actualHours: 7,
  travelHours: 0.3,
  totalHours: 7.3,
  variancePct: 22,
  plannedInstallers: 2,
  actualInstallers: 2,
  plannedDate: '2026-01-01',
  completedDate: '2026-01-02',
  materialCost: 0,
  jobValue: null,
  createdAt: '2026-01-02T00:00:00Z',
  ...over,
});

const target: SimilarJobTarget = {
  projectId: 'uuid-target',
  orderType: 'installation',
  category: 'shelf',
  customer: 'ICA',
  city: 'Stockholm',
  installerCount: 2,
};

describe('similarity score', () => {
  it('gives 100% when every criterion matches', () => {
    expect(scoreSimilarity(target, metric({})).similarity).toBe(100);
  });

  it('drops the weight of each criterion that differs', () => {
    const other = scoreSimilarity(target, metric({ customer: 'Coop', city: 'Malmö' }));
    expect(other.similarity).toBe(100 - SIMILARITY_WEIGHTS.customer - SIMILARITY_WEIGHTS.city);
    expect(other.matched).toEqual(['Order type', 'Category', 'Crew size']);
  });

  it('gives half weight for a crew one person off, none for further away', () => {
    expect(scoreSimilarity(target, metric({ actualInstallers: 3 })).similarity)
      .toBe(Math.round(100 - SIMILARITY_WEIGHTS.installers / 2));
    expect(scoreSimilarity(target, metric({ actualInstallers: 5 })).similarity)
      .toBe(100 - SIMILARITY_WEIGHTS.installers);
  });
});

describe('finding similar jobs', () => {
  const pool = [
    metric({ id: 'a', projectId: 'a' }),
    metric({ id: 'b', projectId: 'b', customer: 'Coop' }),
    metric({ id: 'c', projectId: 'c', orderType: 'transport', category: 'x', customer: 'Coop', city: 'Kiruna', actualInstallers: 9 }),
    metric({ id: 'd', projectId: 'd', city: 'Malmö' }),
    metric({ id: 'e', projectId: 'e', category: 'other' }),
    metric({ id: 'f', projectId: 'f', category: 'other', customer: 'Coop' }),
    metric({ id: 'g', projectId: 'uuid-target' }),
  ];

  it('returns at most five, best match first, and drops the order itself', () => {
    const jobs = findSimilarJobs(target, pool);
    expect(jobs).toHaveLength(5);
    expect(jobs[0].metric.id).toBe('a');
    expect(jobs.map(j => j.metric.id)).not.toContain('g');
    const scores = jobs.map(j => j.similarity);
    expect([...scores].sort((x, y) => y - x)).toEqual(scores);
  });

  it('leaves out jobs with nothing in common', () => {
    expect(findSimilarJobs(target, [pool[2]]).map(j => j.metric.id)).toEqual([]);
  });

  it('averages the actual time of the matches', () => {
    expect(averageActualHours(findSimilarJobs(target, [pool[0]]))).toBe(7.3);
    expect(averageActualHours([])).toBeNull();
  });
});
