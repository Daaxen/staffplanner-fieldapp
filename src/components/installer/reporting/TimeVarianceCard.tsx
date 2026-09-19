import { formatHours, formatVariance, varianceClass, variancePct, varianceTone, type ActualTime } from '@/lib/timeVariance';
import { cn } from '@/lib/utils';

interface TimeVarianceCardProps {
  plannedHours?: number;
  actual: ActualTime;
  className?: string;
}

/** Planned time vs actual time (work + travel) with the deviation in percent. */
const TimeVarianceCard = ({ plannedHours, actual, className }: TimeVarianceCardProps) => {
  const pct = variancePct(plannedHours, actual.total);

  return (
    <div className={cn('rounded-lg border border-border bg-card p-3', className)}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[11px] text-muted-foreground">Planned</p>
          <p className="text-lg font-bold text-foreground">{plannedHours ? formatHours(plannedHours) : '—'}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Actual</p>
          <p className="text-lg font-bold text-foreground">{formatHours(actual.total)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Deviation</p>
          <p className={cn('text-lg font-bold', varianceClass[varianceTone(pct)])}>{formatVariance(pct)}</p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground text-center">
        Work {formatHours(actual.work)} · Travel {formatHours(actual.travel)}
      </p>
    </div>
  );
};

export default TimeVarianceCard;
