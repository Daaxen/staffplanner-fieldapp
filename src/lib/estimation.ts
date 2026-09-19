import type { JobMetric } from '@/lib/jobMetrics';
import type { Project } from '@/data/mockData';
import { findSimilarJobs, targetFromProject, type SimilarJob } from '@/lib/similarJobs';

/**
 * Historical estimation engine.
 *
 * Turns the similar completed jobs (job_metrics) into a planning estimate
 * for a new order: median, average, fastest and longest actual time,
 * plus how many comparable jobs the estimate rests on.
 */
export interface HistoricalEstimate {
  /** Number of similar completed jobs found. */
  sampleSize: number;
  /** Median of total actual hours (work + travel). */
  medianHours: number;
  /** Mean of total actual hours. */
  averageHours: number;
  /** Fastest comparable job. */
  fastestHours: number;
  /** Longest comparable job. */
  longestHours: number;
  /** The jobs behind the estimate, best match first. */
  jobs: SimilarJob[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Estimate from a pre-computed set of similar jobs. Null when nothing is comparable. */
export function estimateFromJobs(jobs: SimilarJob[]): HistoricalEstimate | null {
  if (jobs.length === 0) return null;
  const hours = jobs.map(j => j.metric.totalHours);
  const total = hours.reduce((sum, h) => sum + h, 0);
  return {
    sampleSize: jobs.length,
    medianHours: round1(median(hours)),
    averageHours: round1(total / hours.length),
    fastestHours: round1(Math.min(...hours)),
    longestHours: round1(Math.max(...hours)),
    jobs,
  };
}

/** Estimate for an order against the full history. Considers up to `limit` best matches. */
export function estimateForProject(
  project: Project,
  metrics: JobMetric[],
  projectRowId?: string,
  limit = 10,
): HistoricalEstimate | null {
  const jobs = findSimilarJobs(targetFromProject(project, projectRowId), metrics, limit);
  return estimateFromJobs(jobs);
}
