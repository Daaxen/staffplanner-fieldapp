import { Package, Eye } from 'lucide-react';
import { type Project, projectTypeIcons } from '@/data/mockData';
import { cn } from '@/lib/utils';

interface InstallerOrderBoxProps {
  projects: Project[];
  onPickUp: (project: Project) => void;
  onViewDetail?: (project: Project) => void;
}

const InstallerOrderBox = ({ projects, onPickUp, onViewDetail }: InstallerOrderBoxProps) => {
  const unassigned = projects.filter(p => p.assigneeIds.length === 0 && p.status !== 'cancelled');

  if (unassigned.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No available orders right now</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Package className="w-4 h-4 text-status-open" />
        <span className="text-sm font-semibold text-foreground">
          Available Orders ({unassigned.length})
        </span>
      </div>
      {unassigned.map(project => (
        <div
          key={project.id}
          className="bg-card rounded-xl px-3 py-3 shadow-sm border border-border cursor-pointer active:scale-[0.98] transition-transform"
          onClick={() => onViewDetail?.(project)}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm">{projectTypeIcons[project.projectType]}</span>
            <p className="text-sm font-semibold text-foreground truncate flex-1">{project.name}</p>
          </div>
          <p className="text-xs text-muted-foreground mb-1">{project.client} · {project.location}</p>
          <p className="text-xs text-muted-foreground mb-2">{project.startDate} → {project.endDate}</p>
          <div className="flex items-center gap-2">
            <button
              className="flex-1 text-xs font-bold px-3 py-2 rounded-lg bg-muted text-muted-foreground flex items-center justify-center gap-1.5"
              onClick={(e) => { e.stopPropagation(); onViewDetail?.(project); }}
            >
              <Eye className="w-3.5 h-3.5" />
              View Details
            </button>
            <button
              className="flex-1 text-xs font-bold px-3 py-2 rounded-lg bg-primary text-primary-foreground"
              onClick={(e) => { e.stopPropagation(); onPickUp(project); }}
            >
              Pick Up
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default InstallerOrderBox;
