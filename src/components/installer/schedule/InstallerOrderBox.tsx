import { Package } from 'lucide-react';
import { type Project, projectTypeIcons } from '@/data/mockData';
import { cn } from '@/lib/utils';

interface InstallerOrderBoxProps {
  projects: Project[];
  onPickUp: (project: Project) => void;
}

const InstallerOrderBox = ({ projects, onPickUp }: InstallerOrderBoxProps) => {
  const unassigned = projects.filter(p => p.assigneeIds.length === 0 && p.status !== 'cancelled');

  if (unassigned.length === 0) return null;

  return (
    <div className="mx-4 mb-3 rounded-xl border-2 border-dashed border-status-open/40 bg-status-open/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Package className="w-4 h-4 text-status-open" />
        <span className="text-xs font-semibold text-foreground">
          Available Orders ({unassigned.length})
        </span>
      </div>
      <div className="space-y-2">
        {unassigned.map(project => (
          <div
            key={project.id}
            className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 shadow-sm border border-border cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => onPickUp(project)}
          >
            <span className="text-sm">{projectTypeIcons[project.projectType]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">{project.name}</p>
              <p className="text-[10px] text-muted-foreground">{project.client} · {project.location}</p>
              <p className="text-[10px] text-muted-foreground">{project.startDate} → {project.endDate}</p>
            </div>
            <button
              className="shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground"
              onClick={(e) => { e.stopPropagation(); onPickUp(project); }}
            >
              Pick Up
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InstallerOrderBox;
