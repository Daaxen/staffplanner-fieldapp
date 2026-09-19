import { useMemo } from 'react';
import { Gauge } from 'lucide-react';
import type { Project } from '@/data/mockData';
import { useJobMetrics } from '@/lib/jobMetrics';
import { projectRowId } from '@/lib/appData';
import { estimateForProject } from '@/lib/estimation';
import { formatHours } from '@/lib/timeVariance';
import { cn } from '@/lib/utils';

interface HistoricalEstimateCardProps {
  project: Project;
  className?: string;
}

const Stat = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
  <div className="rounded-lg border border-border bg-card p-2.5 text-center">
    <p className={cn('text-sm font-bold text-foreground', strong && 'text-primary')}>{value}</p>
    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
  </div>
);

/**
 * Estimation card shown on an order before planning: median, average,
 * fastest and longest actual time from similar completed jobs.
 */
const HistoricalEstimateCard = ({ project, className }: HistoricalEstimateCardProps) => {
  const { metrics, loading } = useJobMetrics();

  const estimate = useMemo(
    () => estimateForProject(project, metrics, projectRowId(project.id)),
    [project, metrics],
  );

  return (
    <section className={cn('space-y-2', className)}>
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Gauge className="w-4 h-4" />Historical estimate
      </h3>

      {loading && <p className="text-xs text-muted-foreground">Calculating estimate…</p>}
      {!loading && !estimate && (
        <p className="text-xs text-muted-foreground">
          No similar completed jobs yet — the estimate appears as soon as history exists.
        </p>
      )}

      {estimate && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Stat label="Median time" value={formatHours(estimate.medianHours)} strong />
            <Stat label="Average time" value={formatHours(estimate.averageHours)} />
            <Stat label="Fastest job" value={formatHours(estimate.fastestHours)} />
            <Stat label="Longest job" value={formatHours(estimate.longestHours)} />
            <Stat label="Similar jobs" value={String(estimate.sampleSize)} />
          </div>
          {estimate.sampleSize < 3 && (
            <p className="text-[10px] text-muted-foreground">
              Based on few completed jobs — treat the estimate as indicative.
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default HistoricalEstimateCard;
