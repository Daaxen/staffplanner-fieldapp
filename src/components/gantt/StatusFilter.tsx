import { cn } from '@/lib/utils';
import { type ProjectStatus, statusLabels } from '@/data/mockData';
import { statusColorMap } from '@/lib/projectLifecycle';

interface StatusFilterProps {
  activeStatuses: Set<ProjectStatus>;
  onToggleStatus: (status: ProjectStatus) => void;
  onShowAll: () => void;
}

const StatusFilter = ({ activeStatuses, onToggleStatus, onShowAll }: StatusFilterProps) => {
  const allStatuses = Object.keys(statusLabels) as ProjectStatus[];
  const allActive = activeStatuses.size === allStatuses.length;

  return (
    <div className="flex items-center gap-3 px-6 py-2 border-b border-border bg-card flex-wrap">
      <button
        onClick={onShowAll}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-xs",
          allActive
            ? "text-foreground font-bold bg-secondary"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        )}
      >
        Show all
      </button>
      <div className="w-px h-4 bg-border" />
      {allStatuses.map(status => {
        const isActive = activeStatuses.has(status);
        return (
          <button
            key={status}
            onClick={() => onToggleStatus(status)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded transition-colors",
              isActive
                ? "text-foreground font-bold"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            )}
          >
            <div className={cn(
              "w-2.5 h-2.5 rounded-sm transition-opacity",
              statusColorMap[status],
              !isActive && "opacity-30"
            )} />
            <span className="text-xs">{statusLabels[status]}</span>
          </button>
        );
      })}
    </div>
  );
};

export default StatusFilter;
