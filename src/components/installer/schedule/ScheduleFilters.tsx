import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { type ProjectStatus, type ProjectType, statusLabels, projectTypeLabels } from '@/data/mockData';
import { cn } from '@/lib/utils';

export interface FilterState {
  statuses: ProjectStatus[];
  types: ProjectType[];
}

interface ScheduleFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const allStatuses: ProjectStatus[] = ['open', 'scheduled', 'in-progress', 'completed', 'on-hold', 'cancelled'];
const allTypes: ProjectType[] = ['installation', 'site-survey', 'transport'];

const statusDotMap: Record<string, string> = {
  'scheduled': 'bg-status-scheduled',
  'in-progress': 'bg-status-in-progress',
  'completed': 'bg-status-completed',
  'on-hold': 'bg-status-on-hold',
  'cancelled': 'bg-status-cancelled',
  'open': 'bg-status-open',
};

const ScheduleFilters = ({ filters, onChange }: ScheduleFiltersProps) => {
  const [open, setOpen] = useState(false);

  const activeCount = filters.statuses.length + filters.types.length;

  const toggleStatus = (s: ProjectStatus) => {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter(x => x !== s)
      : [...filters.statuses, s];
    onChange({ ...filters, statuses: next });
  };

  const toggleType = (t: ProjectType) => {
    const next = filters.types.includes(t)
      ? filters.types.filter(x => x !== t)
      : [...filters.types, t];
    onChange({ ...filters, types: next });
  };

  const clearAll = () => onChange({ statuses: [], types: [] });

  return (
    <div className="px-4 py-2 bg-card border-b border-border">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors",
            open || activeCount > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Filter{activeCount > 0 && ` (${activeCount})`}
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-2 pb-1">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {allStatuses.map(s => (
                <button
                  key={s}
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    "flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border transition-colors",
                    filters.statuses.includes(s)
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground"
                  )}
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full", statusDotMap[s])} />
                  {statusLabels[s]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Type</p>
            <div className="flex flex-wrap gap-1.5">
              {allTypes.map(t => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={cn(
                    "text-[10px] font-medium px-2 py-1 rounded-full border transition-colors",
                    filters.types.includes(t)
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {projectTypeLabels[t]}
                </button>
              ))}
            </div>
          </div>
          {activeCount > 0 && (
            <button onClick={clearAll} className="flex items-center gap-1 text-[10px] text-destructive font-medium">
              <X className="w-3 h-3" /> Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ScheduleFilters;
