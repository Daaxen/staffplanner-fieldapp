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
  onUnassignProject?: (projectId: string) => void;
}

/** Returns a value 0-1 representing deadline urgency (1 = overdue or today) */
function getUrgency(project: Project): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(project.endDate);
  end.setHours(0, 0, 0, 0);
  const start = new Date(project.startDate);
  start.setHours(0, 0, 0, 0);

  const totalSpan = Math.max((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24), 1);
  const daysLeft = (end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (daysLeft <= 0) return 1; // overdue
  if (daysLeft >= totalSpan) return 0; // plenty of time
  return 1 - daysLeft / totalSpan;
}

function getUrgencyStyle(urgency: number): { bg: string; border: string; text: string } {
  if (urgency >= 0.9) return { bg: 'rgba(220,38,38,0.25)', border: 'rgba(220,38,38,0.7)', text: 'text-red-100' };
  if (urgency >= 0.7) return { bg: 'rgba(234,88,12,0.20)', border: 'rgba(234,88,12,0.6)', text: '' };
  if (urgency >= 0.5) return { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.5)', text: '' };
  return { bg: '', border: '', text: '' };
}

const OrderBox = ({ projects, onSelectProject, onUnassignProject }: OrderBoxProps) => {
  const unassigned = projects.filter(p => p.assigneeIds.length === 0);

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData('projectId', projectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('projectId');
    if (projectId && onUnassignProject) {
      onUnassignProject(projectId);
    }
  };

  return (
    <div
      className="border-t border-border bg-card px-4 py-3 min-h-[60px]"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-2 mb-2">
        <Package className="w-4 h-4 text-status-open" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Order Box — {unassigned.length} unassigned
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {unassigned.map(project => {
          const urgency = getUrgency(project);
          const urgStyle = getUrgencyStyle(urgency);
          const hasCustomUrgency = urgency >= 0.5;
          return (
            <div
              key={project.id}
              draggable
              onDragStart={(e) => handleDragStart(e, project.id)}
              onClick={() => onSelectProject(project)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md border cursor-grab active:cursor-grabbing transition-colors",
                !hasCustomUrgency && "border-dashed border-status-open/50 bg-status-open/10 hover:bg-status-open/20"
              )}
              style={hasCustomUrgency ? {
                backgroundColor: urgStyle.bg,
                borderColor: urgStyle.border,
                borderStyle: 'solid',
              } : undefined}
            >
              <div className={cn("w-1.5 h-1.5 rounded-full", statusColorMap[project.status])} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{project.name}</p>
                <p className="text-[10px] text-muted-foreground">{project.client} · {project.location}</p>
              </div>
              {urgency >= 0.7 && (
                <span className="text-xs shrink-0" title="Deadline approaching">🔥</span>
              )}
            </div>
          );
        })}
        {unassigned.length === 0 && (
          <p className="text-xs text-muted-foreground/50 italic py-1">Drop projects here to unassign</p>
        )}
      </div>
    </div>
  );
};

export default OrderBox;
