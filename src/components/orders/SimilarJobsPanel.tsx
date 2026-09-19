import { useMemo } from 'react';
import { History, MapPin, Users } from 'lucide-react';
import type { Project } from '@/data/mockData';
import { useJobMetrics } from '@/lib/jobMetrics';
import { projectRowId } from '@/lib/appData';
import { averageActualHours, findSimilarJobs, targetFromProject } from '@/lib/similarJobs';
import { formatHours } from '@/lib/timeVariance';
import { cn } from '@/lib/utils';

interface SimilarJobsPanelProps {
  project: Project;
  className?: string;
}

const barTone = (similarity: number) =>
  similarity >= 70 ? 'bg-status-completed' : similarity >= 40 ? 'bg-status-in-progress' : 'bg-muted-foreground';

/** The five completed jobs that most resemble this order, best match first. */
const SimilarJobsPanel = ({ project, className }: SimilarJobsPanelProps) => {
  const { metrics, loading } = useJobMetrics();

  const jobs = useMemo(
    () => findSimilarJobs(targetFromProject(project, projectRowId(project.id)), metrics, 5),
    [project, metrics],
  );
  const average = averageActualHours(jobs);

  return (
    <section className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <History className="w-4 h-4" />Similar completed jobs
        </h3>
        {average != null && (
          <span className="text-xs text-muted-foreground">Avg actual {formatHours(average)}</span>
        )}
      </div>

      {loading && <p className="text-xs text-muted-foreground">Looking for comparable jobs…</p>}
      {!loading && jobs.length === 0 && (
        <p className="text-xs text-muted-foreground">No comparable completed jobs yet.</p>
      )}

      <div className="space-y-2">
        {jobs.map(({ metric, similarity, matched }) => (
          <div key={metric.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {metric.orderId ?? 'Order'} · {metric.customer ?? 'Unknown customer'}
                </p>
                <p className="text-xs text-muted-foreground">{metric.completedDate}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-foreground">{similarity}%</p>
                <p className="text-[10px] text-muted-foreground">match</p>
              </div>
            </div>

            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full rounded-full', barTone(similarity))} style={{ width: `${similarity}%` }} />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{formatHours(metric.totalHours)} actual</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{metric.actualInstallers} installer{metric.actualInstallers === 1 ? '' : 's'}</span>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{metric.city ?? '—'}</span>
            </div>

            {matched.length > 0 && (
              <p className="mt-1.5 text-[10px] text-muted-foreground">Matched on: {matched.join(', ')}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default SimilarJobsPanel;
