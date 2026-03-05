import { cn } from '@/lib/utils';
import { type Project, type ProjectStatus } from '@/data/mockData';
import { Package } from 'lucide-react';

const statusColorMap: Record<ProjectStatus, string> = {
  'open': 'bg-status-open',
  'scheduled': 'bg-status-scheduled',
  'in-progress': 'bg-status-in-progress',
  'completed': 'bg-status-completed',
  'on-hold': 'bg-status-on-hold',
  'cancelled': 'bg-status-cancelled',
};

interface OrderBoxProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
}

const OrderBox = ({ projects, onSelectProject }: OrderBoxProps) => {
  const unassigned = projects.filter(p => p.assigneeIds.length === 0);

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData('projectId', projectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  if (unassigned.length === 0) return null;

  return (
    <div className="border-t border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Package className="w-4 h-4 text-status-open" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Order Box — {unassigned.length} unassigned
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {unassigned.map(project => (
          <div
            key={project.id}
            draggable
            onDragStart={(e) => handleDragStart(e, project.id)}
            onClick={() => onSelectProject(project)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-status-open/50 bg-status-open/10",
              "cursor-grab active:cursor-grabbing hover:bg-status-open/20 transition-colors"
            )}
          >
            <div className={cn("w-1.5 h-1.5 rounded-full", statusColorMap[project.status])} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{project.name}</p>
              <p className="text-[10px] text-muted-foreground">{project.client} · {project.location}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrderBox;
