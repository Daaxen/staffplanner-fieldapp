import { AlertTriangle, Ban, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduleConflict } from '@/lib/schedulingConflicts';

interface ConflictPanelProps {
  conflicts: ScheduleConflict[];
  className?: string;
  /** Show a confirmation line when there are no conflicts. */
  showClear?: boolean;
}

const ConflictPanel = ({ conflicts, className, showClear = true }: ConflictPanelProps) => {
  if (conflicts.length === 0) {
    if (!showClear) return null;
    return (
      <div className={cn('flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5', className)}>
        <CheckCircle2 className="w-4 h-4 text-status-completed" />
        <p className="text-xs text-muted-foreground">No scheduling conflicts found.</p>
      </div>
    );
  }

  const blocking = conflicts.filter(c => c.severity === 'blocking');
  const warnings = conflicts.filter(c => c.severity === 'warning');

  return (
    <div
      className={cn(
        'rounded-lg border p-2.5 space-y-2',
        blocking.length
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-status-on-hold/40 bg-status-on-hold/10',
        className,
      )}
    >
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        {blocking.length ? (
          <Ban className="w-3.5 h-3.5 text-destructive" />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5 text-status-on-hold" />
        )}
        {blocking.length
          ? `${blocking.length} blocking conflict${blocking.length > 1 ? 's' : ''}`
          : `${warnings.length} scheduling warning${warnings.length > 1 ? 's' : ''}`}
        {blocking.length > 0 && warnings.length > 0 && ` · ${warnings.length} warning${warnings.length > 1 ? 's' : ''}`}
      </p>
      <ul className="space-y-1.5">
        {[...blocking, ...warnings].map(c => (
          <li key={c.id} className="flex items-start gap-2">
            <span className={cn('mt-0.5 shrink-0', c.severity === 'blocking' ? 'text-destructive' : 'text-status-on-hold')}>
              {c.severity === 'blocking' ? <Ban className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-foreground">{c.title}</span>
              <span className="block text-[11px] text-muted-foreground">{c.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      {blocking.length > 0 && (
        <p className="text-[11px] text-destructive font-medium">
          Double bookings are not allowed — resolve these before assigning.
        </p>
      )}
    </div>
  );
};

export default ConflictPanel;
