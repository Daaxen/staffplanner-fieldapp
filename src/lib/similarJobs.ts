import type { JobMetric } from '@/lib/jobMetrics';
import type { Project } from '@/data/mockData';

/**
 * Similar Jobs Engine.
 *
 * Scores completed jobs (job_metrics) against the order being opened, so the
 * planner can see how long comparable work actually took.
 *
 * Weights sum to 100 — the score is read directly as a similarity percentage.
 */
export const SIMILARITY_WEIGHTS = {
  orderType: 25,
  category: 25,
  customer: 20,
  city: 15,
  installers: 15,
} as const;

export interface SimilarJobTarget {
  projectId?: string;
  orderType?: string | null;
  category?: string | null;
  customer?: string | null;
  city?: string | null;
  installerCount: number;
}

export interface SimilarJob {
  metric: JobMetric;
  /** 0–100, higher is more similar. */
  similarity: number;
  /** Which criteria matched, for the "why" line in the UI. */
  matched: string[];
}

const norm = (value?: string | null) => (value ?? '').trim().toLowerCase();

const same = (a?: string | null, b?: string | null) => {
  const x = norm(a);
  const y = norm(b);
  return x.length > 0 && x === y;
};

/** Installer count similarity: exact match scores full, one off scores half. */
function installerScore(target: number, actual: number): number {
  if (target <= 0 || actual <= 0) return 0;
  const diff = Math.abs(target - actual);
  if (diff === 0) return 1;
  if (diff === 1) return 0.5;
  return 0;
}

export function scoreSimilarity(target: SimilarJobTarget, metric: JobMetric): SimilarJob {
  const matched: string[] = [];
  let score = 0;

  if (same(target.orderType, metric.orderType)) { score += SIMILARITY_WEIGHTS.orderType; matched.push('Order type'); }
  if (same(target.category, metric.category)) { score += SIMILARITY_WEIGHTS.category; matched.push('Category'); }
  if (same(target.customer, metric.customer)) { score += SIMILARITY_WEIGHTS.customer; matched.push('Customer'); }
  if (same(target.city, metric.city)) { score += SIMILARITY_WEIGHTS.city; matched.push('City'); }

  const crew = installerScore(target.installerCount, metric.actualInstallers);
  if (crew > 0) {
    score += SIMILARITY_WEIGHTS.installers * crew;
    matched.push(crew === 1 ? 'Crew size' : 'Similar crew size');
  }

  return { metric, similarity: Math.round(score), matched };
}

/**
 * The most relevant completed jobs, best match first.
 * Jobs with nothing in common are left out.
 */
export function findSimilarJobs(
  target: SimilarJobTarget,
  metrics: JobMetric[],
  limit = 5,
): SimilarJob[] {
  return metrics
    .filter(m => m.projectId !== target.projectId)
    .map(m => scoreSimilarity(target, m))
    .filter(job => job.similarity > 0)
    .sort((a, b) => (
      b.similarity - a.similarity
      // newest completed job wins a tie
      || (a.metric.completedDate < b.metric.completedDate ? 1 : -1)
    ))
    .slice(0, limit);
}

/** Build the comparison target from an order. */
export function targetFromProject(project: Project, projectRowId?: string): SimilarJobTarget {
  return {
    projectId: projectRowId,
    orderType: project.projectType,
    category: project.templateId ?? null,
    customer: project.client ?? null,
    city: project.region ?? project.location ?? null,
    installerCount: project.assigneeIds?.length ?? 0,
  };
}

/** Average actual time across the matches — a rough estimate for the new order. */
export function averageActualHours(jobs: SimilarJob[]): number | null {
  if (jobs.length === 0) return null;
  const total = jobs.reduce((sum, j) => sum + j.metric.totalHours, 0);
  return Math.round((total / jobs.length) * 10) / 10;
}
